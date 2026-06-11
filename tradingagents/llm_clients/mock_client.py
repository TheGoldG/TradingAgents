import json
from typing import Any, Dict, List, Optional
from langchain_core.messages import AIMessage
from .base_client import BaseLLMClient

class MockLLMClient(BaseLLMClient):
    """A mock LLM client that returns instant, hardcoded responses to avoid token usage during testing."""
    
    def __init__(
        self,
        model: str,
        base_url: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(model, base_url, **kwargs)

    def invoke(
        self,
        prompt: Any,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
        **kwargs,
    ) -> AIMessage:
        if hasattr(self, "with_structured_output") and kwargs.get("is_structured"):
            # Not fully supported mock, just string fallback
            pass
            
        if isinstance(prompt, list):
            prompt_str = " ".join([getattr(m, 'content', str(m)) for m in prompt])
        else:
            prompt_str = str(prompt)
            
        prompt_lower = prompt_str.lower()
        system_lower = system_prompt.lower() if system_prompt else ""
        
        # 1. Screener prompt matching
        if "select exactly 3 stocks for each of the following 5 categories" in prompt_lower:
            mock_allocations = {
                "Slot 1: Secular Compounder (Big Tech/AI)": ["AAPL", "MSFT", "GOOGL"],
                "Slot 2: Defensive Cash Cow (Consumer/Health)": ["JNJ", "PG", "UNH"],
                "Slot 3: Financial/Infrastructure Lifeline": ["V", "JPM", "MA"],
                "Slot 4: Cyclical/Industrial Value Engine": ["CAT", "DE", "HON"],
                "Slot 5: Asymmetric Moonshot (High Beta)": ["PLTR", "CRWD", "SNOW"]
            }
            return AIMessage(content=f"```json\n{json.dumps(mock_allocations, indent=2)}\n```")
            
        # 2. Judge or Trader "BUY/SELL/HOLD" decision
        if "you must end your response with exactly one of" in system_lower or "final_decision:" in system_lower:
            return AIMessage(content="[MOCK ANALYSIS] Fundamentals are strong, risk is acceptable.\n\nFINAL_DECISION: BUY")
            
        # 3. Market/Sentiment/News/Fundamentals report
        if "report" in prompt_lower or "analysis" in system_lower:
            return AIMessage(content="### Mock Report\nThis is a totally free, instant mock response. Everything looks great!")
            
        # 4. Debates
        if "debate" in system_lower or "bull" in system_lower or "bear" in system_lower:
            return AIMessage(content="[Mock Argument] I think it's a solid choice because of mock reasons.")
            
        # Fallback
        return AIMessage(content="[MOCK RESPONSE] Acknowledged.")

    async def ainvoke(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
        **kwargs,
    ) -> AIMessage:
        # Same logic for async
        return self.invoke(prompt, system_prompt, history, **kwargs)

    def get_llm(self) -> Any:
        return self

    def validate_model(self) -> bool:
        return True
