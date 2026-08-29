from pathlib import Path
from reportlab.lib.colors import Color, HexColor, black, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "fiche-exercices-chapitre-1-distances-cercles.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

WIDTH, HEIGHT = A4
INK = HexColor("#173F5F")
ACCENT = HexColor("#E98655")
SOFT = HexColor("#EEF5F6")
PALE = HexColor("#FAF7F0")
LINE = HexColor("#AABBC2")
MUTED = HexColor("#5F727D")

arial = Path("C:/Windows/Fonts/arial.ttf")
arial_bold = Path("C:/Windows/Fonts/arialbd.ttf")
if arial.exists() and arial_bold.exists():
    pdfmetrics.registerFont(TTFont("Worksheet", str(arial)))
    pdfmetrics.registerFont(TTFont("Worksheet-Bold", str(arial_bold)))
else:
    pdfmetrics.registerFont(TTFont("Worksheet", str(Path("C:/Windows/Fonts/calibri.ttf"))))
    pdfmetrics.registerFont(TTFont("Worksheet-Bold", str(Path("C:/Windows/Fonts/calibrib.ttf"))))

FONT = "Worksheet"
BOLD = "Worksheet-Bold"


def wrapped_lines(text, font, size, max_width):
    words = text.split()
    lines, current = [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if not current or pdfmetrics.stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def text(c, value, x, y, size=9.4, font=FONT, color=black, width=None, leading=None):
    c.setFillColor(color)
    c.setFont(font, size)
    lines = wrapped_lines(value, font, size, width) if width else [value]
    leading = leading or size * 1.28
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def header(c, subtitle):
    c.setFillColor(INK)
    c.rect(0, HEIGHT - 62, WIDTH, 62, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.rect(0, HEIGHT - 62, 8, 62, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont(BOLD, 17)
    c.drawString(32, HEIGHT - 31, "Distances et cercles")
    c.setFont(FONT, 8.5)
    c.drawString(32, HEIGHT - 48, subtitle)
    c.setStrokeColor(MUTED)
    c.setLineWidth(.6)
    c.line(340, HEIGHT - 30, 445, HEIGHT - 30)
    c.line(474, HEIGHT - 30, 563, HEIGHT - 30)
    c.setFillColor(white)
    c.setFont(FONT, 7.5)
    c.drawString(340, HEIGHT - 43, "Nom et prénom")
    c.drawString(474, HEIGHT - 43, "Classe")


def footer(c, page):
    c.setStrokeColor(LINE)
    c.setLineWidth(.5)
    c.line(32, 28, WIDTH - 32, 28)
    c.setFillColor(MUTED)
    c.setFont(FONT, 7.5)
    c.drawString(32, 16, "Chapitre 1 - Fiche d'exercices")
    c.drawRightString(WIDTH - 32, 16, f"{page} / 4")


def section(c, y, label, course_part):
    c.setFillColor(SOFT)
    c.roundRect(32, y - 27, WIDTH - 64, 27, 6, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont(BOLD, 11.5)
    c.drawString(44, y - 18, label)
    c.setFillColor(MUTED)
    c.setFont(FONT, 7.5)
    c.drawRightString(WIDTH - 44, y - 18, course_part)
    return y - 37


def exercise(c, number, title, prompt, y, height, draw=None):
    x, width = 32, WIDTH - 64
    c.setFillColor(white)
    c.setStrokeColor(LINE)
    c.setLineWidth(.7)
    c.roundRect(x, y - height, width, height, 7, fill=1, stroke=1)
    c.setFillColor(ACCENT)
    c.circle(x + 18, y - 18, 11, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont(BOLD, 9)
    c.drawCentredString(x + 18, y - 21, str(number))
    c.setFillColor(INK)
    c.setFont(BOLD, 10.2)
    c.drawString(x + 36, y - 21, title)
    prompt_y = text(c, prompt, x + 14, y - 42, size=8.8, width=width - 28, leading=11.2)
    if draw:
        draw(c, x + 14, y - height + 12, width - 28, max(30, prompt_y - (y - height + 18)))
    return y - height - 10


def answer_lines(c, x, y, width, count=3, gap=16):
    c.setStrokeColor(HexColor("#CBD5D9"))
    c.setLineWidth(.45)
    for index in range(count):
        yy = y + index * gap
        c.line(x, yy, x + width, yy)


def segment_abc(c, x, y, width, height):
    yy = y + height * .55
    ax, cx, bx = x + 55, x + width * .55, x + width - 55
    c.setStrokeColor(INK)
    c.setLineWidth(1.2)
    c.line(ax, yy, bx, yy)
    for px, label in [(ax, "A"), (cx, "C"), (bx, "B")]:
        c.setLineWidth(1.4)
        c.line(px, yy - 5, px, yy + 5)
        c.setFillColor(INK)
        c.setFont(BOLD, 8)
        c.drawCentredString(px, yy - 17, label)
    c.setFont(FONT, 8)
    c.drawCentredString((ax + cx) / 2, yy + 10, "2,8 cm")
    c.drawCentredString((cx + bx) / 2, yy + 10, "4,7 cm")


def midpoint_diagram(c, x, y, width, height):
    yy = y + height * .57
    ax, mx, bx = x + 75, x + width / 2, x + width - 75
    c.setStrokeColor(INK)
    c.setLineWidth(1.2)
    c.line(ax, yy, bx, yy)
    for px, label in [(ax, "A"), (mx, "M"), (bx, "B")]:
        c.line(px, yy - 5, px, yy + 5)
        c.setFont(BOLD, 8)
        c.setFillColor(INK)
        c.drawCentredString(px, yy - 17, label)
    for center in [(ax + mx) / 2, (mx + bx) / 2]:
        c.line(center - 3, yy - 4, center + 3, yy + 4)


def report_diagram(c, x, y, width, height):
    yy1, yy2 = y + height * .68, y + height * .25
    c.setStrokeColor(INK)
    c.setLineWidth(1.1)
    c.line(x + 35, yy1, x + 180, yy1)
    c.line(x + 35, yy1 - 5, x + 35, yy1 + 5)
    c.line(x + 180, yy1 - 5, x + 180, yy1 + 5)
    c.setFillColor(INK)
    c.setFont(BOLD, 8)
    c.drawString(x + 30, yy1 - 17, "E")
    c.drawString(x + 177, yy1 - 17, "F")
    c.line(x + 270, yy2, x + width - 35, yy2)
    c.line(x + 270, yy2 - 5, x + 270, yy2 + 5)
    c.drawString(x + 265, yy2 - 17, "G")
    text(c, "Reporte la longueur EF à partir de G et nomme H le point obtenu.", x + 250, yy2 + 19, 8, width=width - 260)


def circle_points(c, x, y, width, height):
    cx, cy, radius = x + width * .25, y + height * .48, min(53, height * .38)
    c.setStrokeColor(INK)
    c.setLineWidth(1)
    c.circle(cx, cy, radius, fill=0, stroke=1)
    points = [(cx, cy, "O"), (cx + radius, cy, "A"), (cx - 18, cy + 11, "B"), (cx + radius + 34, cy + 14, "C")]
    c.setFillColor(INK)
    for px, py, label in points:
        c.circle(px, py, 1.7, fill=1, stroke=0)
        c.setFont(BOLD, 8)
        c.drawString(px + 4, py + 3, label)
    text(c, "Complète par appartient ou n'appartient pas :", x + width * .50, y + height * .72, 7.7, font=BOLD, width=width * .48)
    text(c, "A ... au cercle     B ... au disque", x + width * .50, y + height * .49, 8.4)
    text(c, "C ... au cercle     C ... au disque", x + width * .50, y + height * .29, 8.4)


def vocabulary_circle(c, x, y, width, height):
    cx, cy, radius = x + width * .24, y + height * .5, min(55, height * .4)
    c.setStrokeColor(INK)
    c.setLineWidth(1)
    c.circle(cx, cy, radius, fill=0, stroke=1)
    c.line(cx - radius, cy, cx + radius, cy)
    c.line(cx, cy, cx + 36, cy + 42)
    c.line(cx - 40, cy + 38, cx + 46, cy - 28)
    for px, py, label in [(cx, cy, "O"), (cx - radius, cy, "A"), (cx + radius, cy, "B"), (cx + 36, cy + 42, "C")]:
        c.setFillColor(INK)
        c.circle(px, py, 1.6, fill=1, stroke=0)
        c.setFont(BOLD, 8)
        c.drawString(px + 3, py + 3, label)
    text(c, "Indique sur la figure :", x + width * .52, y + height * .73, 8.5, font=BOLD)
    text(c, "un rayon : ...............", x + width * .52, y + height * .53, 9)
    text(c, "un diamètre : ...........", x + width * .52, y + height * .35, 9)
    text(c, "une corde : ..............", x + width * .52, y + height * .17, 9)


def construction_space(c, x, y, width, height):
    c.setStrokeColor(HexColor("#D9E1E4"))
    c.setLineWidth(.35)
    step = 14
    xx = x
    while xx <= x + width:
        c.line(xx, y, xx, y + height)
        xx += step
    yy = y
    while yy <= y + height:
        c.line(x, yy, x + width, yy)
        yy += step


def program_figure(c, x, y, width, height):
    cx, cy = x + width * .23, y + height * .53
    radius = min(38, height * .31)
    c.setStrokeColor(INK)
    c.setLineWidth(1)
    c.circle(cx, cy, radius, fill=0, stroke=1)
    c.line(cx - radius, cy, cx + radius, cy)
    for px, label in [(cx - radius, "R"), (cx + radius, "S")]:
        c.line(px, cy - 5, px, cy + 5)
        c.setFillColor(INK)
        c.setFont(BOLD, 8)
        c.drawCentredString(px, cy - 17, label)
    c.line(cx, cy - 5, cx, cy + 5)
    c.setFillColor(INK)
    c.setFont(BOLD, 8)
    c.drawCentredString(cx, cy + 7, "M")
    c.setFont(FONT, 8)
    c.drawCentredString(cx, cy + radius + 8, "RS = 7 cm")
    answer_lines(c, x + width * .48, y + 10, width * .50, 4, 16)


def page_one(c):
    header(c, "Exercices 1 à 4 - Distances, segments et milieu")
    y = section(c, HEIGHT - 79, "Distances et segments", "Partie 1 du cours - exercices 1 et 2")
    y = exercise(c, 1, "Calculer une distance", "Les points A, C et B sont alignés dans cet ordre. Calcule AB puis écris une égalité qui justifie ton calcul.", y, 137, segment_abc)
    y = exercise(c, 2, "Bien lire les notations", "Recopie uniquement les affirmations correctes : A appartient à [BC] ; AB est une longueur ; (AB) est un segment ; [AB] est une droite. Corrige ensuite les autres.", y, 115, lambda c, x, yy, w, h: answer_lines(c, x, yy + 6, w, 3, 17))
    y = section(c, y, "Milieu et codage", "Partie 2 du cours - exercices 3 et 4")
    y = exercise(c, 3, "Utiliser la définition du milieu", "M est le milieu de [AB] et AB = 8,6 cm. Calcule AM et MB, puis complète le codage de la figure.", y, 133, midpoint_diagram)
    exercise(c, 4, "Vrai ou faux ?", "Pour chaque affirmation, réponds et justifie : a) si KI = IL, alors I est le milieu de [KL] ; b) si I est le milieu de [KL], alors KL = 2 × KI ; c) le même codage suffit pour prouver qu'un point appartient à un segment.", y, 104, lambda c, x, yy, w, h: answer_lines(c, x, yy + 4, w, 3, 16))
    footer(c, 1)


def page_two(c):
    header(c, "Exercices 5 à 8 - Compas, cercle et disque")
    y = section(c, HEIGHT - 79, "Reporter une distance au compas", "Partie 3 du cours - exercices 5 et 6")
    y = exercise(c, 5, "Un report sans mesure", "Effectue la construction demandée sans utiliser les graduations de la règle.", y, 155, report_diagram)
    y = exercise(c, 6, "Construire un triangle", "Trace un segment [AB] de 6 cm. Construis au compas un point C tel que AC = 4 cm et BC = 3 cm. Combien de positions de C sont possibles ?", y, 134, construction_space)
    y = section(c, y, "Cercle ou disque ?", "Partie 4 du cours - exercices 7 et 8")
    y = exercise(c, 7, "Appartenir au cercle", "Observe la figure puis complète les quatre phrases.", y, 150, circle_points)
    exercise(c, 8, "Comparer des distances au rayon", "Un cercle a pour centre O et pour rayon 4 cm. D est à 4 cm de O, E à 2,5 cm et F à 5,2 cm. Indique où se trouve chaque point : sur le cercle, dans le disque ou à l’extérieur.", y, 103, lambda c, x, yy, w, h: answer_lines(c, x, yy + 4, w, 3, 16))
    footer(c, 2)


def page_three(c):
    header(c, "Exercices 9 à 12 - Vocabulaire et constructions")
    y = section(c, HEIGHT - 79, "Vocabulaire du cercle", "Partie 5 du cours - exercices 9 et 10")
    y = exercise(c, 9, "Nommer les éléments", "Observe la figure et donne un exemple de chaque élément demandé.", y, 160, vocabulary_circle)
    y = exercise(c, 10, "Rayon et diamètre", "Un cercle a un diamètre de 9,4 cm. Calcule son rayon. Un autre cercle a un rayon de 2,85 cm : calcule son diamètre. Rédige les deux calculs.", y, 112, lambda c, x, yy, w, h: answer_lines(c, x, yy + 4, w, 3, 16))
    y = section(c, y, "Construire avec précision", "Partie 6 du cours - exercices 11 et 12")
    y = exercise(c, 11, "Trois consignes, trois cercles", "Construis : a) le cercle de centre A et de rayon 2,5 cm ; b) le cercle de diamètre [BC] avec BC = 6 cm ; c) le cercle de centre D passant par E.", y, 157, construction_space)
    exercise(c, 12, "Programme de construction", "Écris un programme permettant à un camarade de reproduire exactement cette figure, puis réalise-la sur une feuille. Termine en expliquant pourquoi S appartient au cercle.", y, 127, program_figure)
    footer(c, 3)


def page_four(c):
    header(c, "Tâche complexe - Mobiliser tout le chapitre")
    c.setFillColor(PALE)
    c.roundRect(32, HEIGHT - 196, WIDTH - 64, 112, 9, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.setFont(BOLD, 8.5)
    c.drawString(46, HEIGHT - 108, "MISSION")
    c.setFillColor(INK)
    c.setFont(BOLD, 14)
    c.drawString(46, HEIGHT - 130, "Concevoir une aire de jeux circulaire")
    prompt = ("La mairie dispose d'un terrain rectangulaire de 18 m sur 12 m. Elle veut installer une aire de jeux circulaire "
              "de diamètre 8 m, entièrement à l'intérieur du terrain. Le centre de l'aire doit être à la même distance des deux "
              "petits côtés du terrain. Une allée droite de 4 m reliera ce centre au milieu d'un grand côté.")
    text(c, prompt, 46, HEIGHT - 150, 9, width=WIDTH - 92, leading=11.5)
    text(c, "Produis un plan à l'échelle 1 cm pour 2 m et justifie que toutes les contraintes sont respectées.", 46, HEIGHT - 187, 9.2, font=BOLD, color=INK, width=WIDTH - 92)
    text(c, "Ta production doit comporter une figure codée, les calculs utiles et une courte explication.", 32, HEIGHT - 222, 9.2, color=MUTED, width=WIDTH - 64)
    c.setFillColor(SOFT)
    c.roundRect(32, 62, WIDTH - 64, HEIGHT - 304, 8, fill=1, stroke=0)
    construction_space(c, 44, 75, WIDTH - 88, HEIGHT - 330)
    c.setFillColor(white)
    c.roundRect(44, 75, 156, 42, 6, fill=1, stroke=0)
    text(c, "Échelle : 1 cm représente 2 m", 55, 99, 8, font=BOLD, color=INK)
    text(c, "Pense à laisser visibles tes essais.", 55, 84, 7.5, color=MUTED)
    footer(c, 4)


c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
c.setTitle("Fiche d'exercices - Distances et cercles")
c.setAuthor("Maths au collège")
for page in (page_one, page_two, page_three, page_four):
    page(c)
    c.showPage()
c.save()
print(OUTPUT)
