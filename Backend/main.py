import importlib
import json
from datetime import datetime 
from pathlib import Path

'''Function definitions'''

VALID_MODELS = ("openai", "claude", "perplexity")
MODEL_MODULES = {
    "openai": "models.openai_model",
    "claude": "models.claude_model",
    "perplexity": "models.perplexity_model",
}


def load_prompt(file_name):
    '''Load a prompt from the prompts directory'''
    #BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    prompt_path = f"prompts/{file_name}"
    #os.path.join(BASE_DIR, "..", "prompts", "{}".format(file_name))
    with open(prompt_path, "r") as f:
        return f.read()


def _generate_response(model, prompt):
    '''Generate response from input model'''
    # Check model is valid
    if model not in VALID_MODELS:
        raise ValueError('model must be "openai", "claude", or "perplexity"')

    module = importlib.import_module(MODEL_MODULES[model])
    return module.generate_response(prompt)


def generate_summary(brand_name, model="openai", refresh = False):
    '''Generate a brand summary for a given brand name'''

    # First check if cache exists
    cache_file = Path(f"Outputs/Summaries/{brand_name.lower()}_{model}.json")
    #TODO add condition checking if refresh falls under 'y/n'. If not, ask to retype
    if cache_file.exists() and not refresh:

        print(
            f"[Cache Hit] Loading cached summary for {brand_name}"
        )

        with open(cache_file, "r", encoding='utf-8') as f:
            return json.load(f)["summary"]

    print(
    f"[Cache Miss] Generating summary for {brand_name}"
     )

    # Load the base prompt and schema
    base_prompt = load_prompt("brand_summary_prompt.md")
    schema = load_prompt("brand_summary_schema.md")

    # Replace placeholder in prompt with brand name
    base_prompt = base_prompt.replace("{BRAND_NAME}", brand_name)

    full_prompt = f"""
        {base_prompt}
        
        SCHEMA:
        {schema}
        """
    # Insert prompt into model
    output = _generate_response(model, full_prompt)

    # Save summaries to file
    #directory = os.path.dirname(os.path.abspath(__file__))
    output_path = f"Outputs/Summaries/{brand_name.lower()}_{model}.json"
    #os.path.normpath(os.path.join(directory, "..", "Outputs", "Summaries", f"{brand_name}.json"))

    with open(output_path, "w", encoding="utf-8") as file:
        json.dump({
            "brand": brand_name,
            "model": model,
            "generated_at": datetime.now().isoformat(),
            "summary": output
            }, file, indent=2, ensure_ascii=False)

    return output


def generate_comparison(brand_a, brand_b, summary_a, summary_b, model="openai", refresh = False):
    '''Compare two brands based on their summaries'''

    # First check if comparison exists
    brands = sorted([brand_a.lower(), brand_b.lower()])
    cache_file = Path(f"Outputs/Comparisons/{brands[0]}_vs_{brands[1]}_{model}.json")
    #TODO add condition checking if refresh falls under 'y/n'. If not, ask to retype
    if cache_file.exists() and not refresh:

        print(
            f"[Cache Hit] Loading cached comparison for {brands[0]}_vs_{brands[1]}"
        )

        with open(cache_file, "r", encoding='utf-8') as f:
            return json.load(f)["comparison"]

    print( f"[Cache Miss] Generating comparison for {brands[0]}_vs_{brands[1]}"
    )

    # Load the comparison prompt
    comparison_prompt = load_prompt("comparison_prompt_v1.md")

    full_prompt = f"""
    {comparison_prompt}

    Brand A Summary:
    {summary_a}

    Brand B Summary:
    {summary_b}
    """
    # Insert prompt into model
    output = _generate_response(model, full_prompt)

    # Save summaries to file
    output_path = f"Outputs/Comparisons/{brands[0]}_vs_{brands[1]}_{model}.json"

    with open(output_path, "w", encoding="utf-8") as file:
        json.dump({
            "brands": [brand_a, brand_b],
            "model": model,
            "generated_at": datetime.now().isoformat(),
            "comparison": output
            }, file, indent=2, ensure_ascii=False)

    return output


def main():
    brand_a = input("Enter first brand: ")
    #brand_b = input("Enter second brand: ")

    refresh_summaries = (
        input(
            "Regenerate existing summaries if exist? (y/n): "
        )
        .strip()
        .lower()
        == "y"
    )

    summary_a = generate_summary(brand_a, model="perplexity", refresh = refresh_summaries)
    #summary_b = generate_summary(brand_b, model="perplexity", refresh = refresh_summaries)

    '''refresh_comparison = (
        input(
            "Regenerate existing comparison if exist? (y/n): "
        )
        .strip()
        .lower()
        == "y"
    )'''

    #comparison = generate_comparison(brand_a, brand_b, summary_a, summary_b, model="openai", refresh = refresh_comparison)

    #print("\nFinal Comparison:\n")
    #print(comparison)


if __name__ == "__main__":
    main()
