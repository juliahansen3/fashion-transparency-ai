from clients import anthropic_client


def generate_response(prompt: str) -> str:
    message = anthropic_client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=16384,
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(
        block.text for block in message.content if block.type == "text"
    )
