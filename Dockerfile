FROM python:3-alpine

RUN apk add --no-cache gcc musl-dev libffi-dev openssl-dev rust cargo

WORKDIR /usr/src/app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000
ENV LOG_LEVEL=debug

CMD [ "sh", "-c", "gunicorn --workers=2 --bind=0.0.0.0:5000 --log-level=${LOG_LEVEL} --access-logfile=- push:app" ]
