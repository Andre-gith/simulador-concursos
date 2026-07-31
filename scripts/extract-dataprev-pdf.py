from pathlib import Path
import json
import re
import sys
import fitz

source_dir = Path(sys.argv[1]).resolve()
target_dir = Path(sys.argv[2]).resolve()
exam_path = source_dir / "analista_de_tecnologia_da_informacao_perfil_desenvolvimento_de_software.pdf"
key_path = source_dir / "gabarito.pdf"

exam = fitz.open(exam_path)
answer_key = fitz.open(key_path)
if exam.page_count != 7:
    raise ValueError(f"O caderno deveria possuir 7 páginas; possui {exam.page_count}.")
if answer_key.page_count < 10:
    raise ValueError("O documento de gabarito não contém as páginas esperadas.")

pages = [{"number": index + 1, "text": page.get_text("text")} for index, page in enumerate(exam)]

def answer_ranges(page, expected_ranges):
    tokens = [
        line.strip()
        for line in page.get_text("text").splitlines()
        if re.fullmatch(r"(?:[1-9]\d{0,2}|[CE])", line.strip())
    ]
    answers = {}
    cursor = 0
    for start, end in expected_ranges:
        numbers = [str(number) for number in range(start, end + 1)]
        found = -1
        for index in range(cursor, len(tokens) - len(numbers) + 1):
            if tokens[index:index + len(numbers)] == numbers:
                found = index
                break
        if found < 0:
            raise ValueError(f"Faixa {start}-{end} não encontrada no gabarito.")
        answer_start = found + len(numbers)
        values = []
        while answer_start < len(tokens) and len(values) < len(numbers):
            token = tokens[answer_start]
            answer_start += 1
            if token in ("C", "E"):
                values.append(token)
        if len(values) != len(numbers):
            raise ValueError(f"Gabarito incompleto na faixa {start}-{end}.")
        answers.update(
            {number: value == "C" for number, value in zip(range(start, end + 1), values)}
        )
        cursor = answer_start
    return answers

# Página 2: conhecimentos gerais dos cargos de nível superior.
answers = answer_ranges(answer_key[1], [(1, 20), (21, 40), (41, 50)])
# Página 10: conhecimentos específicos do Cargo 7.
answers.update(answer_ranges(answer_key[9], [(51, 70), (71, 90), (91, 110), (111, 120)]))
if sorted(answers) != list(range(1, 121)):
    raise ValueError("O gabarito não cobre exatamente as questões 1 a 120.")

def question_y(page, number):
    candidates = [
        word for word in page.get_text("words")
        if word[4] == str(number) and word[0] < 150
    ]
    return min((word[1] for word in candidates), default=None)

assets = {}
for number in (119, 120):
    page_number = 3
    page = exam[page_number - 1]
    start_y = question_y(page, number)
    if start_y is None:
        raise ValueError(f"Questão visual {number} não localizada na página 3.")
    next_y = question_y(page, number + 1) if number < 120 else None
    end_y = next_y - 5 if next_y is not None else page.rect.height - 35
    output = target_dir / "assets" / f"questao-{number}"
    output.mkdir(parents=True, exist_ok=True)
    target = output / f"visual-01-p{page_number}.png"
    clip = fitz.Rect(20, max(20, start_y - 8), page.rect.width - 20, end_y)
    page.get_pixmap(matrix=fitz.Matrix(2.4, 2.4), clip=clip, alpha=False).save(target)
    assets[number] = str(target).replace("\\", "/")

print(json.dumps({"pages": pages, "answers": answers, "assets": assets}, ensure_ascii=False))
exam.close()
answer_key.close()
