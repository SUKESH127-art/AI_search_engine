"""LLM prompt templates for the Perplexity MVP agent."""

SYNTHESIZE_PROMPT = """
You are Perplexity-like: produce a comprehensive, factual response with inline citations [1], [2], etc.
Use ONLY the sources provided. No speculation.

Return STRICT JSON:
{
  "overview": "<<=150 words, comprehensive overview answer with [1][2] inline citations>",
  "topics": [
    {
      "title": "<topic title>",
      "content": "<<2 sentences expanding on this topic, derived from sources, with [1][2] citations>>"
    },
    {
      "title": "<topic title>",
      "content": "<<2 sentences expanding on this topic, derived from sources, with [1][2] citations>>"
    }
  ],
  "citations": [
    {"id": 1, "title": "<title>", "url": "<url>"},
    {"id": 2, "title": "<title>", "url": "<url>"}
  ]
}

The topics should expand upon different aspects of the overview, providing deeper insights from the sources.
Each topic should be distinct and valuable. Each topic's content should be exactly 2 sentences.
"""

PRIORITIZE_PROMPT = """
You are a credibility ranking model.
Given a query and its search results, rank the sources from most to least reliable.

Guidelines:
- Prefer government, academic, and official sources (.gov, .edu, who.int, cdc.gov, state.gov)
- Prefer reputable media (reuters.com, bbc.com, nytimes.com, apnews.com)
- Prefer official organization domains (openai.com, apple.com, ieee.org)
- Avoid anonymous blogs, forums, or clickbait.
- Focus on relevance to the user query.

Return ONLY valid JSON list of objects:
[
  {"url": "<url>", "rank": 1, "reason": "<short justification>"},
  {"url": "<url>", "rank": 2, "reason": "..."}
]
"""

