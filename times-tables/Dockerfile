FROM python:3.11-alpine

WORKDIR /app

RUN pip install flask requests --no-cache-dir

COPY app/ /app/

EXPOSE 5000

CMD ["python", "server.py"]
