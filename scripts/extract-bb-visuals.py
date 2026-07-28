from pathlib import Path
import json
import fitz

ROOT = Path(__file__).resolve().parents[1]
CONFIGS = [
    ("agente-tecnologia", "AGENTE DE TECNOLOGIA - Microrregião 158 - TI - GABARITO 1.pdf"),
    ("agente-comercial", "PROVA A - AGENTE COMERCIAL - GABARITO 1.pdf"),
]

def question_y(page, number):
    candidates = [
        word for word in page.get_text("words")
        if word[4] == str(number) and word[0] < 130 and 45 < word[1] < page.rect.height - 50
    ]
    return min((word[1] for word in candidates), default=None)

for specialty, pdf_name in CONFIGS:
    directory = ROOT / "data" / "imports" / "banco-do-brasil" / specialty
    review = json.loads((directory / "extraction-review.json").read_text(encoding="utf-8"))
    exam = json.loads((directory / "exam.json").read_text(encoding="utf-8"))
    pages_by_question = {q["number"]: q["sourcePage"] for q in exam["questions"]}
    document = fitz.open(directory / pdf_name)
    for item in review["requiresVisualReview"]:
        number = item["question"]
        if specialty == "agente-tecnologia" and number == 67:
            continue
        start_page = pages_by_question[number]
        next_page = pages_by_question.get(number + 1, start_page)
        output = directory / "assets" / f"questao-{number}"
        output.mkdir(parents=True, exist_ok=True)
        asset_index = 1
        for page_number in range(start_page, next_page + 1):
            page = document[page_number - 1]
            start_y = question_y(page, number) if page_number == start_page else 35
            if start_y is None:
                start_y = 35
            end_y = page.rect.height - 30
            if page_number == next_page:
                next_y = question_y(page, number + 1)
                if next_y is not None:
                    end_y = next_y - 5
            if end_y <= start_y + 20:
                continue
            clip = fitz.Rect(20, max(20, start_y - 8), page.rect.width - 20, end_y)
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), clip=clip, alpha=False)
            target = output / f"visual-{asset_index:02d}-p{page_number}.png"
            pixmap.save(target)
            asset_index += 1
    document.close()
