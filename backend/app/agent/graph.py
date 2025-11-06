"""LangGraph workflow definition for the Fleetline Agent."""
from langgraph.graph import StateGraph, END
from backend.app.agent.state import AgentState
from backend.app.agent.nodes.search import search
from backend.app.agent.nodes.synthesize import synthesize
from backend.app.agent.nodes.enrich_images import enrich_images
from backend.app.agent.nodes.format_output import format_output


def build_graph():
    """Compile LangGraph workflow connecting all agent nodes."""
    g = StateGraph(AgentState)
    g.add_node("search", search)
    g.add_node("synthesize", synthesize)
    g.add_node("enrich_images", enrich_images)
    g.add_node("format_output", format_output)

    # Define flow (search directly to synthesize, no prioritization)
    g.add_edge("search", "synthesize")
    g.add_edge("synthesize", "enrich_images")
    g.add_edge("enrich_images", "format_output")
    g.add_edge("format_output", END)

    g.set_entry_point("search")
    return g.compile()

