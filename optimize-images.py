"""
SAMA CROCHET — تحسين الصور (Feature 04)

شنو كيدير هاد السكريبت:
  - كيقرا الصور (.jpg / .jpeg / .png) من فولدر  images/
  - كيصاوب نسخة WebP خفيفة ديال كل صورة فـ  images/opt/
  - بنفس الاسم والرقم:  images/35.jpg  ->  images/opt/35.webp
  - ما كيبدل، ما كيمسح، وما كيزيد حتى حاجة فالصور الأصلية
  - إلا كانت نسخة WebP أكبر من الأصل (صورة صغيرة أصلا)، كيخليها وما كيصاوبش ليها نسخة

كيفاش تشغلو:
  1) حط هاد الملف فـ فولدر المشروع (حداء index.html و فولدر images)
  2) pip install pillow        (مرة وحدة فقط)
  3) python optimize-images.py     (ولا:  py optimize-images.py  فـ Windows)
"""

import io
import os
import sys

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow ماشي مثبت. دير:  pip install pillow")

SRC_DIR = "images"
OUT_DIR = os.path.join("images", "opt")
MAX_SIZE = 800      # أكبر ضلع (بالبيكسل) للنسخة الخفيفة
QUALITY = 80        # جودة WebP (80 = جودة زوينة وحجم صغير)
EXTENSIONS = (".jpg", ".jpeg", ".png")


def main():
    if not os.path.isdir(SRC_DIR):
        sys.exit("ما لقيتش فولدر '%s'. شغّل السكريبت من فولدر المشروع." % SRC_DIR)

    os.makedirs(OUT_DIR, exist_ok=True)

    names = sorted(
        f for f in os.listdir(SRC_DIR)
        if f.lower().endswith(EXTENSIONS) and os.path.isfile(os.path.join(SRC_DIR, f))
    )
    if not names:
        sys.exit("ما لقيت حتى صورة فـ '%s'." % SRC_DIR)

    total_before = 0
    total_after = 0
    created = 0
    kept = 0

    print("%-14s %10s %10s   %s" % ("الملف", "قبل (KB)", "بعد (KB)", "النتيجة"))
    print("-" * 56)

    for name in names:
        src_path = os.path.join(SRC_DIR, name)
        base = os.path.splitext(name)[0]          # 48.1.jpg -> 48.1
        out_path = os.path.join(OUT_DIR, base + ".webp")
        original_size = os.path.getsize(src_path)

        try:
            with Image.open(src_path) as im:
                im = ImageOps.exif_transpose(im)
                im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
                im.thumbnail((MAX_SIZE, MAX_SIZE), Image.LANCZOS)   # ما كيكبرش الصور الصغيرة
                buf = io.BytesIO()
                im.save(buf, "WEBP", quality=QUALITY, method=6)
        except Exception as e:
            print("%-14s %10s %10s   خطأ: %s" % (name, "-", "-", e))
            continue

        new_size = buf.tell()
        total_before += original_size

        if new_size >= original_size:
            # الأصل أصغر: ما نصاوبو والو، والموقع غادي يستعمل الأصل
            total_after += original_size
            kept += 1
            if os.path.exists(out_path):
                os.remove(out_path)   # نسخة قديمة ديال تشغيل سابق
            print("%-14s %10.0f %10.0f   بقات الصورة الأصلية (صغيرة أصلا)"
                  % (name, original_size / 1024, original_size / 1024))
            continue

        with open(out_path, "wb") as f:
            f.write(buf.getvalue())
        total_after += new_size
        created += 1
        print("%-14s %10.0f %10.0f   opt/%s.webp" % (name, original_size / 1024, new_size / 1024, base))

    print("-" * 56)
    print("تصاوبو %d نسخة، و%d بقاو كيف هما." % (created, kept))
    print("المجموع: %.1f MB  ->  %.1f MB" % (total_before / 1048576, total_after / 1048576))
    print("الصور الأصلية ما تبدلات حتى وحدة.")


if __name__ == "__main__":
    main()
