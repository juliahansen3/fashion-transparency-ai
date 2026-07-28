from clients import openai_client


def generate_response(prompt: str) -> str:
    response = openai_client.responses.create(
        model="gpt-4.1-mini",
        input=prompt,
    )
    return response.output_text
