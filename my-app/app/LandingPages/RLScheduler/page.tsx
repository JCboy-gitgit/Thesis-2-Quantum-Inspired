'use client';

import React, { useState, useEffect } from 'react';
import styles from './RLScheduler.module.css';

interface Rule {
  rule_id: string;
  name: string;
  description: string;
  penalty: number;
}

interface TrainingStats {
  episodes_trained: number;
  avg_reward: number;
  best_reward: number;
  worst_reward: number;
  agent_stats: {
    q_table_size: number;
    experience_buffer_size: number;
    exploration_rate: number;
    learning_rate: number;
  };
}

interface TrainingHistory {
  timestamp: string;
  iteration: number;
  avg_reward: number;
}

export default function RLScheduler() {
  const [activeTab, setActiveTab] = useState<'rules' | 'train' | 'stats' | 'schedule'>('rules');
  const [rules, setRules] = useState<Rule[]>([]);
  const [trainingStats, setTrainingStats] = useState<TrainingStats | null>(null);
  const [trainingHistory, setTrainingHistory] = useState<TrainingHistory[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  const [newRule, setNewRule] = useState({
    rule_id: '',
    name: '',
    description: '',
    penalty: 100,
  });

  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  // Fetch rules on mount
  useEffect(() => {
    fetchRules();
    fetchStats();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/rl/rules`);
      const data = await response.json();
      setRules(data.rules || []);
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/rl/stats`);
      const data = await response.json();
      setTrainingStats(data);
      setLoading(false);

      // Also fetch history
      const historyResponse = await fetch(`${apiUrl}/api/rl/training-history?limit=20`);
      const historyData = await historyResponse.json();
      setTrainingHistory(historyData.history || []);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  const addRule = async () => {
    if (!newRule.rule_id || !newRule.name) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/rl/rules/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });

      if (response.ok) {
        alert('Rule added successfully!');
        setNewRule({ rule_id: '', name: '', description: '', penalty: 100 });
        fetchRules();
      } else {
        alert('Error adding rule');
      }
    } catch (error) {
      console.error('Error adding rule:', error);
      alert('Error adding rule');
    }
  };

  const trainAgent = async () => {
    setIsTraining(true);
    setTrainingProgress(0);

    try {
      const dummyClasses = [
        { id: 'cs101', name: 'Intro to CS', capacity_needed: 30 },
        { id: 'cs102', name: 'Data Structures', capacity_needed: 25 },
      ];

      const dummyRooms = [
        { id: 'r101', capacity: 50, type: 'lecture' },
        { id: 'r102', capacity: 40, type: 'lecture' },
      ];

      const timeSlots = [
        'monday_08:00', 'monday_09:00', 'tuesday_08:00', 'tuesday_09:00',
        'wednesday_08:00', 'wednesday_09:00', 'thursday_08:00', 'thursday_09:00',
      ];

      // Simulate training progress
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));

        const response = await fetch(`${apiUrl}/api/rl/train`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classes: dummyClasses,
            rooms: dummyRooms,
            time_slots: timeSlots,
            iterations: 5,
          }),
        });

        if (response.ok) {
          setTrainingProgress(Math.min((i + 1) * 20, 100));
        }
      }

      fetchStats();
      setIsTraining(false);
      alert('Training completed!');
    } catch (error) {
      console.error('Error training agent:', error);
      setIsTraining(false);
      alert('Error during training');
    }
  };

  const resetAgent = async () => {
    if (confirm('Are you sure? This will clear all learned data.')) {
      try {
        const response = await fetch(`${apiUrl}/api/rl/reset`, { method: 'POST' });
        if (response.ok) {
          alert('Agent reset successfully!');
          fetchStats();
          fetchRules();
        }
      } catch (error) {
        console.error('Error resetting agent:', error);
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>RL Scheduler - AI Learning Dashboard</h1>
        <p>Train your scheduler to learn custom rules and improve over time</p>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabNav}>
        <button
          className={`${styles.tab} ${activeTab === 'rules' ? styles.active : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          📋 Rules
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'train' ? styles.active : ''}`}
          onClick={() => setActiveTab('train')}
        >
          🤖 Train Agent
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'stats' ? styles.active : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Statistics
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'schedule' ? styles.active : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          📅 Compare
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {/* Rules Tab */}
        {activeTab === 'rules' && (
          <div className={styles.section}>
            <h2>Custom Scheduling Rules</h2>
            <p className={styles.subtitle}>Define obstacles and rules for the AI to learn</p>

            {/* Add New Rule */}
            <div className={styles.card}>
              <h3>Add New Rule</h3>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Rule ID (e.g., no_friday_afternoon)</label>
                  <input
                    type="text"
                    placeholder="unique_rule_id"
                    value={newRule.rule_id}
                    onChange={(e) => setNewRule({ ...newRule, rule_id: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Rule Name</label>
                  <input
                    type="text"
                    placeholder="No Friday Afternoons"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Penalty (learning weight)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={newRule.penalty}
                    onChange={(e) => setNewRule({ ...newRule, penalty: parseInt(e.target.value) })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Description</label>
                  <input
                    type="text"
                    placeholder="Describe the rule..."
                    value={newRule.description}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  />
                </div>
              </div>
              <button className={styles.btnPrimary} onClick={addRule}>
                + Add Rule
              </button>
            </div>

            {/* Registered Rules List */}
            <div className={styles.card}>
              <h3>Registered Rules ({rules.length})</h3>
              {rules.length === 0 ? (
                <p className={styles.empty}>No rules registered yet. Add one above!</p>
              ) : (
                <div className={styles.rulesList}>
                  {rules.map((rule) => (
                    <div key={rule.rule_id} className={styles.ruleItem}>
                      <div className={styles.ruleHeader}>
                        <h4>{rule.name}</h4>
                        <span className={styles.penalty}>Penalty: {rule.penalty}</span>
                      </div>
                      <p>{rule.description}</p>
                      <code className={styles.ruleId}>{rule.rule_id}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rule Examples */}
            <div className={styles.card}>
              <h3>Example Rules</h3>
              <ul className={styles.exampleList}>
                <li>
                  <strong>no_7am:</strong> No classes before 8 AM (helps students and teachers sleep)
                </li>
                <li>
                  <strong>no_friday_afternoon:</strong> Avoid Friday after 3 PM (everyone wants to leave early)
                </li>
                <li>
                  <strong>teacher_lunch:</strong> Keep lunch break 12-1 PM for teachers
                </li>
                <li>
                  <strong>max_2_hours:</strong> No class longer than 2 hours (attention span!)
                </li>
                <li>
                  <strong>room_clustering:</strong> Group classes in same building to reduce walking
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Training Tab */}
        {activeTab === 'train' && (
          <div className={styles.section}>
            <h2>Train the RL Agent</h2>
            <p className={styles.subtitle}>Teach your AI to respect the rules you defined</p>

            <div className={styles.card}>
              <h3>Training Control</h3>
              <div className={styles.trainingBox}>
                <div className={styles.trainingInfo}>
                  <p>
                    The RL agent learns from sample schedules, evaluating them against your custom rules.
                    Each training episode improves the agent's decision-making.
                  </p>
                  <p className={styles.highlight}>
                    After training, schedules will automatically respect your rules!
                  </p>
                </div>

                {isTraining ? (
                  <div className={styles.progressBox}>
                    <p>Training in progress...</p>
                    <div className={styles.progressBar}>
                      <div className={styles.progress} style={{ width: `${trainingProgress}%` }}></div>
                    </div>
                    <p>{trainingProgress}% Complete</p>
                  </div>
                ) : (
                  <button className={styles.btnTrain} onClick={trainAgent} disabled={isTraining}>
                    🚀 Start Training (5 episodes)
                  </button>
                )}
              </div>
            </div>

            {/* Training Tips */}
            <div className={styles.card}>
              <h3>Training Tips</h3>
              <ul className={styles.tipsList}>
                <li>
                  <strong>More rules = harder training:</strong> Start with 2-3 rules, then add more
                </li>
                <li>
                  <strong>Higher penalty = more important:</strong> Set penalties based on rule importance
                </li>
                <li>
                  <strong>Multiple training runs improve learning:</strong> Train several times to refine
                </li>
                <li>
                  <strong>Monitor rewards:</strong> Rewards should increase over episodes (shown in stats)
                </li>
              </ul>
            </div>

            <div className={styles.card}>
              <h3>Advanced Options</h3>
              <button className={styles.btnDanger} onClick={resetAgent}>
                🔄 Reset Agent (Clear Learning)
              </button>
              <p className={styles.disclaimer}>
                Warning: This will erase all learned knowledge. Use only if you want to start fresh.
              </p>
            </div>
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'stats' && (
          <div className={styles.section}>
            <h2>Learning Progress</h2>
            <p className={styles.subtitle}>Monitor how well your AI is learning</p>

            {loading ? (
              <p>Loading statistics...</p>
            ) : trainingStats ? (
              <>
                {/* Stats Grid */}
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <h4>Episodes Trained</h4>
                    <p className={styles.statValue}>{trainingStats.episodes_trained}</p>
                    <p className={styles.statLabel}>training runs completed</p>
                  </div>
                  <div className={styles.statCard}>
                    <h4>Average Reward</h4>
                    <p className={styles.statValue}>{trainingStats.avg_reward.toFixed(2)}</p>
                    <p className={styles.statLabel}>higher is better</p>
                  </div>
                  <div className={styles.statCard}>
                    <h4>Best Reward</h4>
                    <p className={styles.statValue}>{trainingStats.best_reward.toFixed(2)}</p>
                    <p className={styles.statLabel}>peak performance</p>
                  </div>
                  <div className={styles.statCard}>
                    <h4>Q-Table Size</h4>
                    <p className={styles.statValue}>{trainingStats.agent_stats.q_table_size}</p>
                    <p className={styles.statLabel}>learned states</p>
                  </div>
                </div>

                {/* Learning Graph */}
                <div className={styles.card}>
                  <h3>Reward Over Time</h3>
                  {trainingHistory.length > 0 ? (
                    <div className={styles.chart}>
                      <div className={styles.chartBars}>
                        {trainingHistory.map((entry, idx) => (
                          <div key={idx} className={styles.bar}>
                            <div
                              className={styles.barFill}
                              style={{
                                height: `${Math.max(
                                  10,
                                  (entry.avg_reward / (trainingStats.best_reward || 100)) * 100
                                )}%`,
                              }}
                              title={`Episode ${entry.iteration}: ${entry.avg_reward.toFixed(2)}`}
                            ></div>
                            <p>{entry.iteration}</p>
                          </div>
                        ))}
                      </div>
                      <p className={styles.chartLabel}>Episode Progress</p>
                    </div>
                  ) : (
                    <p className={styles.empty}>No training history yet. Train the agent to see progress!</p>
                  )}
                </div>

                {/* Agent Details */}
                <div className={styles.card}>
                  <h3>Agent Configuration</h3>
                  <div className={styles.agentDetails}>
                    <div>
                      <strong>Exploration Rate:</strong> {trainingStats.agent_stats.exploration_rate}
                    </div>
                    <div>
                      <strong>Learning Rate:</strong> {trainingStats.agent_stats.learning_rate}
                    </div>
                    <div>
                      <strong>Experience Buffer:</strong>{' '}
                      {trainingStats.agent_stats.experience_buffer_size} transitions stored
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p>No statistics available. Train the agent to see results.</p>
            )}
          </div>
        )}

        {/* Schedule Comparison Tab */}
        {activeTab === 'schedule' && (
          <div className={styles.section}>
            <h2>Schedule Comparison</h2>
            <p className={styles.subtitle}>Compare QIA vs RL-optimized schedules</p>

            <div className={styles.card}>
              <h3>QIA vs Reinforcement Learning</h3>
              <div className={styles.comparison}>
                <div className={styles.compColumn}>
                  <h4>QIA (Traditional)</h4>
                  <ul>
                    <li>Fast optimization algorithm</li>
                    <li>Hard-coded constraints only</li>
                    <li>No learning over time</li>
                    <li>Best for: Well-defined problems</li>
                  </ul>
                </div>
                <div className={styles.compColumn}>
                  <h4>RL Augmented</h4>
                  <ul>
                    <li>Learns custom rules dynamically</li>
                    <li>Improves with experience</li>
                    <li>Adapts to preferences</li>
                    <li>Best for: Complex/evolving rules</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h3>How They Work Together</h3>
              <div className={styles.workflow}>
                <div className={styles.step}>
                  <span className={styles.stepNum}>1</span>
                  <p>
                    <strong>QIA generates</strong> initial high-quality schedule
                  </p>
                </div>
                <div className={styles.arrow}>→</div>
                <div className={styles.step}>
                  <span className={styles.stepNum}>2</span>
                  <p>
                    <strong>RL evaluates</strong> against custom rules
                  </p>
                </div>
                <div className={styles.arrow}>→</div>
                <div className={styles.step}>
                  <span className={styles.stepNum}>3</span>
                  <p>
                    <strong>Agent learns</strong> what violations hurt most
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h3>Result</h3>
              <p className={styles.result}>
                Schedules that are both optimal AND respectful of your custom rules! 🎉
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
