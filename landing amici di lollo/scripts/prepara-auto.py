# Prepara le immagini dell'auto per l'intestazione animata, partendo da public/img/auto-fiocco.jpg (1200x349):
#   auto-strada.webp  cielo e strada trasparenti (dietro ci sono le scintille e la strada in CSS, che continua ai lati)
# Uso: python3 scripts/prepara-auto.py   (serve Pillow: pip install pillow)
from pathlib import Path
from PIL import Image, ImageDraw

IMG = Path(__file__).resolve().parent.parent / 'public' / 'img'
NAVY = (19, 40, 74)
STRADA = (92, 101, 116)
TRATTINI_Y = (293, 305)
# centro e raggio di cerchione e pneumatico, misurati sulla foto (servono a non bucare le ruote)
RUOTE = {
    'ant': {'c': (431, 253.5), 'cerchio': 29, 'gomma': 44},
    'post': {'c': (757.5, 262), 'cerchio': 31, 'gomma': 45},
}

foto = Image.open(IMG / 'auto-fiocco.jpg').convert('RGBA')
w, h = foto.size
auto = foto.copy()
px = auto.load()

def in_gomma(x, y):
    return any((x - r['c'][0]) ** 2 + (y - r['c'][1]) ** 2 <= r['gomma'] ** 2 for r in RUOTE.values())

# 1. cielo: riempimento dal bordo alto
for x in range(0, w, 20):
    if max(abs(a - b) for a, b in zip(px[x, 0][:3], NAVY)) < 60:
        ImageDraw.floodfill(auto, (x, 0), NAVY + (0,), thresh=40)

# 2. trattini dipinti color strada (fuori dalle gomme), così la strada diventa un unico grigio
for y in range(*TRATTINI_Y):
    for x in range(w):
        # fuori dalle gomme tutto; dentro solo ciò che non è gomma nera (i cerchioni finiscono sopra i trattini)
        if not in_gomma(x, y) or max(px[x, y][:3]) >= 75:
            px[x, y] = STRADA + (255,)

# 3. strada: riempimento dai bordi; non entra nei cerchioni perché li separa la gomma nera
for seme in [(0, 320), (w - 1, 320), (600, 330), (300, 280), (950, 280)]:
    if px[seme][3]:
        ImageDraw.floodfill(auto, seme, (0, 0, 0, 0), thresh=30)

auto.save(IMG / 'auto-strada.webp', quality=82, method=6)

print('ok')
