from pathlib import Path
import json
import re
import sys

import fitz

source_dir = Path(sys.argv[1]).resolve()
target_dir = Path(sys.argv[2]).resolve()
exam_path = source_dir / "manutencao_mecanica.pdf"
key_path = source_dir / "gabarito (1).pdf"

exam = fitz.open(exam_path)
answer_key = fitz.open(key_path)
if exam.page_count != 17:
    raise ValueError(f"A Prova 9 deveria possuir 17 páginas; possui {exam.page_count}.")
if answer_key.page_count != 3:
    raise ValueError(f"O gabarito deveria possuir 3 páginas; possui {answer_key.page_count}.")

page_ranges = {
    2: (1, 1),
    3: (2, 7),
    4: (8, 10),
    5: (11, 13),
    6: (14, 16),
    7: (17, 20),
    8: (21, 28),
    9: (29, 34),
    10: (35, 40),
    11: (41, 42),
    12: (43, 45),
    13: (46, 47),
    14: (48, 50),
    15: (51, 55),
    16: (56, 60),
}
visual_questions = {11, 12, 13, 14, 30, 32, 34, 35, 38, 41, 42, 43, 46, 50, 56, 57, 60}


def normalize(value):
    return re.sub(r"\n{3,}", "\n\n", re.sub(r"[ \t]+\n", "\n", value)).strip()


def clean_fragment(value):
    lines = []
    for line in value.splitlines():
        stripped = line.strip()
        if (
            stripped.startswith("pcimarkpci ")
            or stripped == "www.pciconcursos.com.br"
            or stripped in {"TRANSPETRO", "TERRA", "RASCUNHO", "Continua"}
            or stripped.startswith("PROVA 9 - MANUTENÇÃO - MECÂNICA")
        ):
            continue
        lines.append(line)
    return normalize("\n".join(lines))


questions = {}
question_starts = {}
for page_number, (start_number, end_number) in page_ranges.items():
    page = exam[page_number - 1]
    text = page.get_text("text").replace("\r", "")
    candidates = [
        match
        for match in re.finditer(r"(?m)^\s*(\d{1,2})\s*$", text)
        if start_number <= int(match.group(1)) <= end_number
    ]
    valid = []
    for index, match in enumerate(candidates):
        end = candidates[index + 1].start() if index + 1 < len(candidates) else len(text)
        fragment = text[match.end():end]
        alternatives = list(
            re.finditer(
                r"(?m)^\(([A-E])\)\s*([\s\S]*?)(?=^\([A-E]\)|\Z)",
                fragment,
            )
        )
        if len(alternatives) == 5:
            valid.append((match, fragment, alternatives))
    numbers = [int(item[0].group(1)) for item in valid]
    expected = list(range(start_number, end_number + 1))
    if numbers != expected:
        raise ValueError(
            f"Página {page_number}: sequência de questões inesperada ({numbers})."
        )
    for match, fragment, alternatives in valid:
        number = int(match.group(1))
        statement = clean_fragment(fragment[: alternatives[0].start()])
        parsed_alternatives = []
        for alternative in alternatives:
            letter = alternative.group(1)
            text_value = clean_fragment(alternative.group(2))
            if number == 32:
                text_value = f"Alternativa visual {letter} — consultar o recurso oficial."
            if not text_value:
                raise ValueError(f"Questão {number}: alternativa {letter} vazia.")
            parsed_alternatives.append({"letter": letter, "text": text_value})
        questions[number] = {
            "number": number,
            "statement": statement,
            "alternatives": parsed_alternatives,
            "sourcePage": page_number,
        }
    for block in page.get_text("blocks"):
        block_text = block[4].strip()
        match = re.match(r"^(\d{1,2})\b", block_text)
        if match and start_number <= int(match.group(1)) <= end_number:
            number = int(match.group(1))
            question_starts.setdefault(number, (page_number, block[0], block[1], block[2]))

if sorted(questions) != list(range(1, 61)):
    raise ValueError("A prova deve conter exatamente as questões 1 a 60.")

# As questões 1 a 10 compartilham o texto-base publicado na página 2.
portuguese_page = exam[1].get_text("text").replace("\r", "")
context_start = portuguese_page.find("Brasil, paraíso dos agrotóxicos")
question_one_candidates = list(
    re.finditer(r"(?m)^\s*(?:1|2)\s*$", portuguese_page)
)
question_one_start = next(
    match.start()
    for index, match in enumerate(question_one_candidates)
    if match.group(0).strip() == "1"
    and len(
        re.findall(
            r"(?m)^\([A-E]\)",
            portuguese_page[
                match.end():
                (
                    question_one_candidates[index + 1].start()
                    if index + 1 < len(question_one_candidates)
                    else len(portuguese_page)
                )
            ],
        )
    )
    == 5
)
portuguese_context = clean_fragment(
    portuguese_page[context_start:question_one_start]
)
if not portuguese_context:
    raise ValueError("Texto-base de Língua Portuguesa não localizado.")
for number in range(1, 11):
    questions[number]["statement"] = normalize(
        f"{portuguese_context}\n\n{questions[number]['statement']}"
    )

# O quadro de dados da questão 27 é impresso depois da alternativa E.
data_marker = "\nDado\n"
last_alternative = questions[27]["alternatives"][-1]
if data_marker not in last_alternative["text"]:
    raise ValueError("Quadro de dados da questão 27 não localizado.")
answer_text, data_text = last_alternative["text"].split(data_marker, 1)
last_alternative["text"] = normalize(answer_text)
questions[27]["statement"] = normalize(
    f"{questions[27]['statement']}\n\nDado\n{data_text}"
)


def row_answers(page, allowed_numbers, x_ranges=None):
    words = page.get_text("words")
    result = {}
    for word in words:
        if not word[4].isdigit():
            continue
        number = int(word[4])
        if number not in allowed_numbers:
            continue
        if x_ranges and not any(low <= word[0] <= high for low, high in x_ranges):
            continue
        same_line = sorted(
            (
                candidate
                for candidate in words
                if abs(candidate[1] - word[1]) < 2
                and candidate[0] > word[2]
                and candidate[0] - word[2] < 35
                and candidate[4] in {"A", "B", "C", "D", "E"}
            ),
            key=lambda candidate: candidate[0],
        )
        if same_line:
            result[number] = same_line[0][4]
    return result


answers = row_answers(answer_key[0], set(range(1, 21)))
specific = row_answers(
    answer_key[2],
    set(range(21, 61)),
    x_ranges=[(60, 85), (120, 145)],
)
answers.update(specific)
if sorted(answers) != list(range(1, 61)):
    raise ValueError(f"O gabarito da Prova 9 não cobre 1 a 60: {sorted(answers)}.")

assets = {}
for number in sorted(visual_questions):
    page_number, x0, y0, x1 = question_starts[number]
    page = exam[page_number - 1]
    full_width = x0 < page.rect.width / 2 and x1 > page.rect.width / 2
    if full_width:
        left, right = 20, page.rect.width - 20
        next_candidates = [
            start[2]
            for candidate, start in question_starts.items()
            if start[0] == page_number and candidate > number and start[2] > y0
        ]
    else:
        is_left = x0 < page.rect.width / 2
        left = 20 if is_left else page.rect.width / 2 + 5
        right = page.rect.width / 2 - 5 if is_left else page.rect.width - 20
        next_candidates = [
            start[2]
            for candidate, start in question_starts.items()
            if start[0] == page_number
            and start[2] > y0
            and ((start[1] < page.rect.width / 2) == is_left)
        ]
    bottom = min(next_candidates) - 5 if next_candidates else page.rect.height - 35
    output = target_dir / "assets" / f"questao-{number}"
    output.mkdir(parents=True, exist_ok=True)
    target = output / f"visual-01-p{page_number}.png"
    clip = fitz.Rect(left, max(20, y0 - 8), right, bottom)
    page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), clip=clip, alpha=False).save(target)
    assets[number] = str(target).replace("\\", "/")

print(
    json.dumps(
        {
            "questions": [questions[number] for number in range(1, 61)],
            "answers": answers,
            "assets": assets,
        },
        ensure_ascii=False,
    )
)
exam.close()
answer_key.close()
