"""
RL Agent State Persistence - Save/Load to Supabase

Handles saving and loading the RL agent's Q-table and training history
to Supabase so learning survives server restarts.
"""

import json
from typing import Dict, Optional, Any
from datetime import datetime
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


class RLStatePersistence:
    """Manages RL agent state persistence to Supabase."""

    def __init__(self, supabase_client=None):
        """Initialize persistence manager."""
        self.supabase = supabase_client
        self.agent_id = "main"

    def serialize_q_table(self, q_table: Dict) -> str:
        """Convert Q-table to JSON string for storage."""
        try:
            # Convert defaultdict structure to regular dict
            serializable = {}
            for state_hash, actions in q_table.items():
                serializable[state_hash] = dict(actions)
            return json.dumps(serializable)
        except Exception as e:
            logger.error(f"Error serializing Q-table: {e}")
            return "{}"

    def deserialize_q_table(self, q_table_json: str) -> Dict:
        """Convert JSON string back to Q-table structure."""
        try:
            data = json.loads(q_table_json)
            # Reconstruct as defaultdict
            q_table = defaultdict(lambda: defaultdict(float))
            for state_hash, actions in data.items():
                q_table[state_hash] = defaultdict(float, actions)
            return q_table
        except Exception as e:
            logger.error(f"Error deserializing Q-table: {e}")
            return defaultdict(lambda: defaultdict(float))

    async def save_agent_state(self, rl_engine) -> bool:
        """Save RL agent state to Supabase."""
        if not self.supabase:
            logger.warning("Supabase client not initialized, skipping save")
            return False

        try:
            q_table_json = self.serialize_q_table(rl_engine.agent.q_table)
            training_history_json = json.dumps(
                rl_engine.training_history,
                default=str
            )

            stats = rl_engine.get_training_stats()

            # Upsert (insert or update)
            response = self.supabase.table("rl_agent_state").upsert(
                {
                    "agent_id": self.agent_id,
                    "q_table": q_table_json,
                    "training_history": training_history_json,
                    "episodes_trained": stats.get("episodes_trained", 0),
                    "avg_reward": float(stats.get("avg_reward", 0)),
                    "best_reward": float(stats.get("best_reward", 0)),
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).execute()

            logger.info(f"Saved RL agent state: {len(rl_engine.agent.q_table)} states")
            return True

        except Exception as e:
            logger.error(f"Error saving agent state: {e}")
            return False

    async def load_agent_state(self, rl_engine) -> bool:
        """Load RL agent state from Supabase."""
        if not self.supabase:
            logger.warning("Supabase client not initialized, starting fresh")
            return False

        try:
            response = self.supabase.table("rl_agent_state").select(
                "q_table,training_history,episodes_trained,avg_reward,best_reward"
            ).eq("agent_id", self.agent_id).execute()

            if not response.data or len(response.data) == 0:
                logger.info("No saved RL state found, starting fresh")
                return False

            record = response.data[0]

            # Restore Q-table
            rl_engine.agent.q_table = self.deserialize_q_table(record["q_table"])

            # Restore training history
            try:
                rl_engine.training_history = json.loads(record["training_history"] or "[]")
            except:
                rl_engine.training_history = []

            logger.info(
                f"Loaded RL agent state: "
                f"{len(rl_engine.agent.q_table)} states, "
                f"{record['episodes_trained']} episodes trained"
            )
            return True

        except Exception as e:
            logger.error(f"Error loading agent state: {e}")
            return False

    async def get_agent_stats(self) -> Optional[Dict]:
        """Get stored agent statistics from Supabase."""
        if not self.supabase:
            return None

        try:
            response = self.supabase.table("rl_agent_state").select(
                "episodes_trained,avg_reward,best_reward,updated_at"
            ).eq("agent_id", self.agent_id).execute()

            if response.data and len(response.data) > 0:
                return response.data[0]
            return None

        except Exception as e:
            logger.error(f"Error getting agent stats: {e}")
            return None

    async def reset_agent_state(self) -> bool:
        """Delete saved agent state from Supabase."""
        if not self.supabase:
            return False

        try:
            self.supabase.table("rl_agent_state").delete().eq(
                "agent_id", self.agent_id
            ).execute()

            logger.info("Deleted RL agent state from Supabase")
            return True

        except Exception as e:
            logger.error(f"Error deleting agent state: {e}")
            return False
