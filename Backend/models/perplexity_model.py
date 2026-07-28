from clients import perplexity_client


def generate_response(prompt: str) -> str:
    completion = perplexity_client.chat.completions.create(
        model="perplexity/sonar",
        messages=[{"role": "user", "content": prompt}],
    )
    return completion.choices[0].message.content or ""
