
export function initTutorial() {
    const startBtn = document.getElementById('start-tutorial');
    if (startBtn) {
        startBtn.addEventListener('click', (e) => {
            e.preventDefault();
            startTutorialFlow();
        });
    }
}

// Simple overlay tutorial (Intro)
export function startTutorialFlow() {
    // Re-using the overlay creation logic if it exists elsewhere, otherwise simpler alert for now
    // Assuming createOverlay is not defined here based on previous read, let's use the interactive tour instead
    // or just redirect to interactive tour if called manually
    
    // For now, let's just trigger the interactive tour directly when manually called, 
    // or show the prompt. Let's show the prompt to give them a choice.
    showTutorialPrompt(() => startInteractiveTour(), () => {});
}

export function showTutorialPrompt(onAccept, onDecline) {
    // Check if overlay already exists
    if (document.getElementById('tutorial-prompt-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'tutorial-prompt-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    overlay.style.zIndex = '1000';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.backdropFilter = 'blur(5px)';

    const content = document.createElement('div');
    content.style.backgroundColor = '#1f2326';
    content.style.padding = '40px';
    content.style.borderRadius = '8px';
    content.style.maxWidth = '500px';
    content.style.textAlign = 'center';
    content.style.border = '1px solid #333';
    content.style.boxShadow = '0 0 20px rgba(255, 70, 85, 0.2)';
    content.style.color = '#fff';
    content.style.fontFamily = "'Inter', sans-serif";

    content.innerHTML = `
        <div style="font-size: 50px; margin-bottom: 20px;">🎓</div>
        <h2 style="color: #ff4655; margin-bottom: 15px; font-family: 'Valorant', sans-serif; letter-spacing: 1px;">New Manager Orientation</h2>
        <p style="color: #ccc; margin-bottom: 30px; line-height: 1.6;">Welcome to the team! Would you like a quick tour of the management interface to get you started?</p>
        <div style="display: flex; gap: 15px; justify-content: center;">
            <button id="decline-tutorial" style="background: transparent; border: 1px solid #555; color: #aaa; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: all 0.2s;">No, I know what I'm doing</button>
            <button id="accept-tutorial" style="background: #ff4655; border: none; color: #fff; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 15px rgba(255, 70, 85, 0.3); transition: all 0.2s;">Yes, show me around</button>
        </div>
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    document.getElementById('accept-tutorial').onclick = () => {
        overlay.remove();
        if (onAccept) onAccept();
    };

    document.getElementById('decline-tutorial').onclick = () => {
        overlay.remove();
        if (onDecline) onDecline();
    };
}

// Interactive Tour (Highlights elements)
export function startInteractiveTour(onComplete) {
    const steps = [
        {
            selector: '.sidebar',
            title: "Navigation Sidebar",
            text: "This is your command center. Access all areas of team management from here.",
            position: 'right'
        },
        {
            selector: '#careerInfo',
            title: "Team Identity",
            text: "Your team logo and manager name are displayed here.",
            position: 'right'
        },
        // Dynamic Tournament Buttons (will only show if visible)
        {
            selector: '[data-tour="kickoff"]',
            title: "Kickoff Tournament",
            text: "The first challenge of the season. Win here to qualify for Masters.",
            position: 'right'
        },
        {
            selector: '[data-tour="masters-bangkok"]',
            title: "Masters Bangkok",
            text: "The first international event. Compete against the best teams from all regions.",
            position: 'right'
        },
        {
            selector: '[data-tour="regular-season"]',
            title: "Regional Groups",
            text: "The main league season. Fight for your spot in the playoffs.",
            position: 'right'
        },
        {
            selector: '[data-tour="regular-season-playoffs"]',
            title: "Playoffs",
            text: "The final hurdle before Champions. Only the top teams survive.",
            position: 'right'
        },
        // Standard Buttons
        {
            selector: '[data-tour="dashboard"]',
            title: "My Office",
            text: "Your main dashboard. Get a quick overview of your team's status, finances, and upcoming tasks.",
            position: 'right'
        },
        {
            selector: '[data-tour="calendar"]',
            title: "Calendar",
            text: "View the season schedule, upcoming matches, and important dates.",
            position: 'right'
        },
        {
            selector: '[data-tour="standings"]',
            title: "Standings",
            text: "Track your position in the league table. Top teams qualify for international events!",
            position: 'right'
        },
        {
            selector: '[data-tour="manage-team"]',
            title: "Manage Team",
            text: "The locker room. Adjust your starting lineup, view player morale, and manage contracts.",
            position: 'right'
        },
        {
            selector: '[data-tour="players"]',
            title: "Players Hub",
            text: "Scouting network. Search for free agents and sign new talent to improve your roster.",
            position: 'right'
        },
        {
            selector: '[data-tour="league"]',
            title: "League Info",
            text: "Information about other teams and the competitive ecosystem.",
            position: 'right'
        },
        {
            selector: '[data-tour="strategy"]',
            title: "Strategy Board",
            text: "Define your playstyle. Adjust aggression, economy, and focus to counter your opponents.",
            position: 'right'
        },
        {
            selector: '[data-tour="stats"]',
            title: "Statistics",
            text: "Deep dive into the numbers. Analyze K/D, ACS, and other key metrics.",
            position: 'right'
        },
        {
            selector: '[data-tour="goat-meter"]',
            title: "GOAT Meter",
            text: "Who is the Greatest of All Time? Track player legacies and compare stats.",
            position: 'right'
        },
        {
            selector: '[data-tour="scripts"]',
            title: "Scripts",
            text: "Advanced tools and custom scripts to automate or enhance your management experience.",
            position: 'right'
        },
        {
            selector: '[data-tour="export"]',
            title: "Save & Export",
            text: "Keep your progress safe. Export your save file to back it up locally.",
            position: 'right'
        }
    ];

    // Filter steps for elements that actually exist
    const validSteps = steps.filter(step => document.querySelector(step.selector));

    if (validSteps.length === 0) {
        console.warn("No valid tutorial steps found.");
        if (onComplete) onComplete();
        return;
    }

    let currentStepIndex = 0;
    
    // Create Highlighter
    const highlighter = document.createElement('div');
    highlighter.id = 'tour-highlighter';
    highlighter.style.position = 'absolute';
    // Use a large box-shadow to dim the rest of the screen
    highlighter.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.75)';
    highlighter.style.borderRadius = '4px';
    highlighter.style.zIndex = '10000';
    highlighter.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    highlighter.style.pointerEvents = 'none'; // Let clicks pass through if needed, but we mostly want to block
    highlighter.style.border = '2px solid #ff4655';
    document.body.appendChild(highlighter);

    // Create Tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'tour-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = '#1f2326';
    tooltip.style.padding = '20px';
    tooltip.style.borderRadius = '8px';
    tooltip.style.width = '300px';
    tooltip.style.zIndex = '10001';
    tooltip.style.color = '#fff';
    tooltip.style.border = '1px solid #333';
    tooltip.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
    tooltip.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    document.body.appendChild(tooltip);

    function showStep(index) {
        // Ensure index is within bounds
        if (index < 0 || index >= validSteps.length) {
            finishTour();
            return;
        }

        const step = validSteps[index];
        const el = document.querySelector(step.selector);
        
        if (!el) {
            // Element missing (maybe navigation changed), skip to next
            console.warn(`Element not found for step: ${step.title}`);
            showStep(index + 1);
            return;
        }

        // Scroll into view
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Update Highlighter Position
        const updatePosition = () => {
            const rect = el.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            highlighter.style.width = `${rect.width + 10}px`;
            highlighter.style.height = `${rect.height + 10}px`;
            highlighter.style.top = `${rect.top + scrollTop - 5}px`;
            highlighter.style.left = `${rect.left + scrollLeft - 5}px`;

            // Position Tooltip
            let tooltipTop = rect.top + scrollTop;
            let tooltipLeft = rect.right + scrollLeft + 20;

            // Adjust if off screen (right edge)
            if (tooltipLeft + 300 > document.documentElement.clientWidth) {
                tooltipLeft = rect.left + scrollLeft - 320; // Show on left
            }
            // Adjust if off screen (bottom edge)
            if (tooltipTop + 200 > document.documentElement.clientHeight) {
                tooltipTop = rect.bottom + scrollTop - 150; // Shift up
            }
            // Adjust if off screen (top edge)
            if (tooltipTop < scrollTop) {
                tooltipTop = scrollTop + 10;
            }

            tooltip.style.top = `${tooltipTop}px`;
            tooltip.style.left = `${tooltipLeft}px`;
        };

        // Call immediately and also after a slight delay to allow for scrolling/layout shifts
        updatePosition();
        setTimeout(updatePosition, 100);
        setTimeout(updatePosition, 300); // Backup for slower animations

        // Update Content
        tooltip.innerHTML = `
            <h3 style="color: #ff4655; margin-top: 0; margin-bottom: 10px; font-family: 'Valorant', sans-serif; letter-spacing: 1px;">${step.title}</h3>
            <p style="color: #ccc; font-size: 0.95rem; line-height: 1.5; margin-bottom: 20px;">${step.text}</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 0.8rem; color: #666;">Step ${index + 1} of ${validSteps.length}</div>
                <div style="display: flex; gap: 10px;">
                    ${index > 0 ? `<button id="tour-prev" style="background: transparent; border: 1px solid #555; color: #fff; padding: 6px 12px; border-radius: 4px; cursor: pointer; transition: all 0.2s;">Prev</button>` : ''}
                    <button id="tour-next" style="background: #ff4655; border: none; color: #fff; padding: 6px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
                        ${index === validSteps.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        `;

        // Bind events (need to wait for DOM update)
        // Use timeout 0 to ensure render
        setTimeout(() => {
            const nextBtn = document.getElementById('tour-next');
            if (nextBtn) {
                nextBtn.onclick = () => {
                    if (index === validSteps.length - 1) {
                        finishTour();
                    } else {
                        showStep(index + 1);
                    }
                };
            }

            const prevBtn = document.getElementById('tour-prev');
            if (prevBtn) {
                prevBtn.onclick = () => {
                    showStep(index - 1);
                };
            }
        }, 0);
    }

    function finishTour() {
        if (document.getElementById('tour-highlighter')) document.getElementById('tour-highlighter').remove();
        if (document.getElementById('tour-tooltip')) document.getElementById('tour-tooltip').remove();
        if (onComplete) onComplete();
    }

    // Start
    showStep(0);
}
