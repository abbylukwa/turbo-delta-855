FROM python:3.11-alpine

# Install QR code library
RUN pip install --no-cache-dir qrcode

# Create a simple Python script
RUN echo '#!/usr/bin/env python3
import qrcode
import sys

if len(sys.argv) < 2:
    print("Usage: python script.py <text> [output_file]")
    print("Example: python script.py \\\"Hello World\\\" output.png")
    sys.exit(1)

text = sys.argv[1]
output_file = sys.argv[2] if len(sys.argv) > 2 else None

qr = qrcode.QRCode()
qr.add_data(text)
qr.make(fit=True)

if output_file:
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(output_file)
    print(f"Saved: {output_file}")
else:
    qr.print_ascii()
' > /app/qr-simple.py

# Set working directory
WORKDIR /app

# Make it executable
RUN chmod +x qr-simple.py

# Default command
CMD ["python", "qr-simple.py", "--help"]
