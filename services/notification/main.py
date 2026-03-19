import pika
import json
import time
import os

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

def on_message(channel, method, properties, body):
    data = json.loads(body)
    print(f"[Notification] Event received: {data}")
    channel.basic_ack(delivery_tag=method.delivery_tag)

def start_consumer():
    while True:
        try:
            print("[Notification] Connecting to RabbitMQ...")
            connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
            channel = connection.channel()
            channel.queue_declare(queue="reservation_events", durable=True)
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue="reservation_events", on_message_callback=on_message)
            print("[Notification] Waiting for messages...")
            channel.start_consuming()
        except pika.exceptions.AMQPConnectionError:
            print("[Notification] RabbitMQ not ready, retrying in 5s...")
            time.sleep(5)

if __name__ == "__main__":
    start_consumer()