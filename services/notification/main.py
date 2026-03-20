import pika
import json
import time
import os

# configure RabbitMQ
RABBITMQ_URL = os.environ.get(
    "RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"
    #guest:guest is RabbitMQ's default username and password
    # amqp = advanced message queing Protocol
    # 5672 is default port
)

# automatically called by pika every time a message arrives
# aka a callback function, and RabbitMQ calls it
def on_message(channel, method, properties, body):
    data = json.loads(body) # body is raw message in bytes, json.loads converts to a python dictionary
    print(f"[Notification] Event received: {data}")
    # delivery tag is an ID for each message so RabbitMQ knows which message is being ACK
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

# a Python convention, that means only run file is file is run directly and not imported by another file
# standard way to start python script, since there is n FastAPI connection here
if __name__ == "__main__":
    start_consumer()