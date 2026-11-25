"""Generate a synthetic Hebrew iPhone WhatsApp export (zip) for local testing."""
import random, zipfile, datetime, sys
random.seed(7)
L, R = "‎", "‏"
people = ["אמא", "שרית", "תאיר", "אלחנן ", "נאוה", "רעי"]
weights = [17, 13, 13, 11, 10, 2]
lines = [
  f"[1.1.2025, 08:00:00] משפחה מתרחבת: {L}ההודעות והשיחות מוצפנות מקצה לקצה.",
  f"[1.1.2025, 08:00:00] משפחה מתרחבת: {L}אמא יצר/ה את הקבוצה \"משפחה מתרחבת\"",
]
texts = ["בוקר טוב בובי ❤️", "מי בא לשבת?", "חחחחחח מת", "הבאתי עוגה 😍", "איפה אתם", "מאמי תתקשר", "קניתי בשופרסל ב-89 שקל",
  "נשמה שלי ❤️❤️", "יאללה מגיעים", "מזל טוב!!! 🎉👏", "שבת שלום", "איזה יום מטורף", "תמונה מהים", "חח לא נכון",
  "צריך לסגור את הבית בצפון", "מי לוקח את סבתא?", "אני בפקק", "סבבה", "😂😂😂", "בוקר טוב לכולם"]
t = datetime.datetime(2025, 1, 1, 8, 5)
end = datetime.datetime(2025, 11, 20)
while t < end:
    if t.weekday() == 5 and 6 <= t.hour < 18:
        t += datetime.timedelta(hours=1); continue
    p = random.choices(people, weights)[0]
    stamp = f"[{t.day}.{t.month}.{t.year}, {t:%H:%M:%S}]"
    r = random.random()
    if r < 0.08: lines.append(f"{L}{stamp} {p}: {L}התמונה הושמטה")
    elif r < 0.1: lines.append(f"{R}{stamp} {p}: {L}השמע הושמט")
    elif r < 0.11: lines.append(f"{stamp} {p}: שורה ראשונה\nשורה שנייה ארוכה של אותה הודעה עם עוד מילים")
    else: lines.append(f"{stamp} {p}: {random.choice(texts)}")
    gap = random.expovariate(1/6) if 8 <= t.hour < 23 else random.expovariate(1/90)
    if random.random() < 0.01: gap += 60*24*random.randint(1, 5)
    t += datetime.timedelta(minutes=gap + 0.2)
out = sys.argv[1]
with zipfile.ZipFile(out, "w") as z: z.writestr("_chat.txt", "\n".join(lines) + "\n")
print(len(lines), "lines →", out)
