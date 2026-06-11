import json
from typing import Any, Dict, List, Optional
from langchain_core.messages import AIMessage
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from .base_client import BaseLLMClient

class _MockLangChainModel(FakeListChatModel):
    """An internal LangChain-compatible model that returns our dynamic mock responses."""
    responses: list = []

    def invoke(self, prompt: Any, config: Optional[Any] = None, **kwargs) -> AIMessage:
        if isinstance(prompt, list):
            prompt_str = " ".join([getattr(m, 'content', str(m)) for m in prompt])
        else:
            prompt_str = str(prompt)
            
        prompt_lower = prompt_str.lower()
        
        # 1. Screener prompt matching
        import re
        screener_match = re.search(r"select exactly (\d+) stocks for each", prompt_lower)
        if screener_match:
            requested_count = int(screener_match.group(1))
            mock_allocations = {
                "Slot 1: Secular Compounder (Big Tech/AI)": ["AAPL", "MSFT", "GOOGL", "NVDA", "META"][:requested_count],
                "Slot 2: Defensive Cash Cow (Consumer/Health)": ["JNJ", "PG", "UNH", "KO", "PEP"][:requested_count],
                "Slot 3: Financial/Infrastructure Lifeline": ["V", "JPM", "MA", "AXP", "BAC"][:requested_count],
                "Slot 4: Cyclical/Industrial Value Engine": ["CAT", "DE", "HON", "MMM", "GE"][:requested_count],
                "Slot 5: Asymmetric Moonshot (High Beta)": ["PLTR", "CRWD", "SNOW", "NET", "DDOG"][:requested_count]
            }
            return AIMessage(content=f"```json\n{json.dumps(mock_allocations, indent=2)}\n```")
            
        # 2. Judge or Trader "BUY/SELL/HOLD" decision
        if "you must end your response with exactly one of" in prompt_lower or "final_decision:" in prompt_lower:
            return AIMessage(content="[MOCK ANALYSIS] Fundamentals are strong, risk is acceptable.\n\nFINAL_DECISION: BUY")
            
        # 3. Market/Sentiment/News/Fundamentals report
        if "report" in prompt_lower or "analysis" in prompt_lower:
            return AIMessage(content="### Mock Report\nThis is a totally free, instant mock response. Everything looks great!")
            
        # 4. Debates
        if "debate" in prompt_lower or "bull" in prompt_lower or "bear" in prompt_lower:
            return AIMessage(content="[Mock Argument] I think it's a solid choice because of mock reasons.")
            
        # Fallback
        return AIMessage(content="[MOCK RESPONSE] Acknowledged.")

    async def ainvoke(self, prompt: Any, config: Optional[Any] = None, **kwargs) -> AIMessage:
        return self.invoke(prompt, config, **kwargs)

    def bind_tools(self, tools: Any, **kwargs) -> Any:
        return self


class MockLLMClient(BaseLLMClient):
    """A mock LLM client that returns instant, hardcoded responses to avoid token usage during testing."""
    
    def __init__(
        self,
        model: str,
        base_url: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(model, base_url, **kwargs)
        self._llm = _MockLangChainModel(responses=[])

    def invoke(self, *args, **kwargs) -> AIMessage:
        return self._llm.invoke(*args, **kwargs)

    async def ainvoke(self, *args, **kwargs) -> AIMessage:
        return await self._llm.ainvoke(*args, **kwargs)

    def get_llm(self) -> Any:
        # LangGraph requires a LangChain Runnable. We return our internal subclass.
        return self._llm

    def validate_model(self) -> bool:
        return True
