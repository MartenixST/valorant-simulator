import React from 'react';

const TUTORIAL_STEPS = [
  {
    title: "Welcome, Manager!",
    content: "You're now in charge of a professional Valorant team. Your goal is to climb the ranks, win Champions, and build a legendary roster.",
    target: "center",
    section: "career-dashboard"
  },
  {
    title: "The Dashboard",
    content: "This is your Office. Check your Inbox for scouting reports, contract offers, and league updates every week.",
    target: ".inbox.box",
    section: "career-dashboard"
  },
  {
    title: "Managing Your Roster",
    content: "In the 'Manage Team' section, you can see your players' stats, assign their roles (Duelist, Sentinel, etc.), and even edit their details if you're in the mood for some customization.",
    target: ".nav-item[onClick*='career-manage-team']",
    section: "career-dashboard"
  },
  {
    title: "Strategic Depth",
    content: "Go to the Strategy tab to set your team's playstyle, economic policy, and weekly training activity. This is key to winning matches and developing talent.",
    target: ".nav-item[onClick*='career-strategy']",
    section: "career-dashboard"
  },
  {
    title: "Advancing Time",
    content: "Ready to see your team in action? Click 'Simulate Week' to advance the calendar, trigger training gains, and play your scheduled matches.",
    target: ".sim-week-btn",
    section: "career-dashboard"
  }
];

const TutorialOverlay = ({ step, onNext, onSkip }) => {
  const current = TUTORIAL_STEPS[step];
  if (!current) return null;

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-backdrop" onClick={onSkip}></div>
      <div className={`tutorial-card ${current.target === 'center' ? 'centered' : 'highlight'}`}>
        <div className="tutorial-header">
          <span className="tutorial-step-count">Step {step + 1} of {TUTORIAL_STEPS.length}</span>
          <button className="tutorial-skip" onClick={onSkip}>Skip Tutorial</button>
        </div>
        <div className="tutorial-body">
          <h3>{current.title}</h3>
          <p>{current.content}</p>
        </div>
        <div className="tutorial-footer">
          <button className="btn-tutorial-next" onClick={onNext}>
            {step === TUTORIAL_STEPS.length - 1 ? "Finish" : "Next Step"}
          </button>
        </div>
      </div>
      {current.target !== 'center' && (
        <div className="tutorial-pointer" style={{ position: 'absolute' }}>
          {/* We'll use CSS to position this or just highlight the target */}
        </div>
      )}
    </div>
  );
};

export default TutorialOverlay;
