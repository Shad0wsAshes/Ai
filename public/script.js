let currentToken = localStorage.getItem('dmToken');
let deviceId = localStorage.getItem('deviceId') || generateDeviceId();
let currentNiche = null;
let currentProductTitle = null;
let currentTOC = [];

function generateDeviceId() {
  const id = 'device_' + Math.random().toString(36).substring(2, 15);
  localStorage.setItem('deviceId', id);
  return id;
}

function showLoading(text = 'Processing...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

function showView(viewId) {
  const views = ['dashboardView', 'synthesiseView', 'ghostwriterView', 'mentorView'];
  views.forEach(view => {
    document.getElementById(view).classList.add('hidden');
  });
  document.getElementById(viewId).classList.remove('hidden');
}

async function verifyToken() {
  const token = document.getElementById('tokenInput').value.trim();
  const errorEl = document.getElementById('tokenError');

  if (!token) {
    errorEl.textContent = 'Please enter a token';
    errorEl.classList.remove('hidden');
    return;
  }

  try {
    showLoading('Verifying token...');

    const response = await fetch('/api/verifyToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, deviceId })
    });

    const data = await response.json();

    if (data.valid) {
      currentToken = token;
      localStorage.setItem('dmToken', token);

      if (data.isMaster) {
        document.getElementById('tokenModal').classList.add('hidden');
        document.getElementById('passwordModal').classList.remove('hidden');
      } else {
        document.getElementById('tokenModal').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        showView('dashboardView');
      }
    } else {
      errorEl.textContent = data.message;
      errorEl.classList.remove('hidden');
    }

    hideLoading();
  } catch (error) {
    errorEl.textContent = 'Failed to verify token. Please try again.';
    errorEl.classList.remove('hidden');
    hideLoading();
  }
}

async function verifyPassword() {
  const password = document.getElementById('passwordInput').value;
  const errorEl = document.getElementById('passwordError');

  try {
    showLoading('Verifying password...');

    const response = await fetch('/api/admin/verifyPassword', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (data.valid) {
      window.location.href = '/admin';
    } else {
      errorEl.textContent = 'Invalid password';
      errorEl.classList.remove('hidden');
    }

    hideLoading();
  } catch (error) {
    errorEl.textContent = 'Failed to verify password. Please try again.';
    errorEl.classList.remove('hidden');
    hideLoading();
  }
}

document.getElementById('verifyTokenBtn').addEventListener('click', verifyToken);
document.getElementById('tokenInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') verifyToken();
});

document.getElementById('verifyPasswordBtn').addEventListener('click', verifyPassword);
document.getElementById('passwordInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') verifyPassword();
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('dmToken');
  location.reload();
});

document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    const mode = card.dataset.mode;
    if (mode === 'synthesise') {
      showView('synthesiseView');
    } else if (mode === 'ghostwriter') {
      showView('ghostwriterView');
      loadGhostwriterMode();
    } else if (mode === 'mentor') {
      showView('mentorView');
    }
  });
});

document.getElementById('backFromSynthesise').addEventListener('click', () => showView('dashboardView'));
document.getElementById('backFromGhostwriter').addEventListener('click', () => showView('dashboardView'));
document.getElementById('backFromMentor').addEventListener('click', () => showView('dashboardView'));

document.getElementById('beginSynthesise').addEventListener('click', async () => {
  try {
    showLoading('Generating niches...');

    const response = await fetch('/api/generateNiches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: currentToken })
    });

    const data = await response.json();

    if (data.niches) {
      displayNiches(data.niches);
      document.getElementById('synthesiseStart').classList.add('hidden');
      document.getElementById('nicheSelection').classList.remove('hidden');
    }

    hideLoading();
  } catch (error) {
    console.error('Failed to generate niches:', error);
    hideLoading();
    alert('Failed to generate niches. Please try again.');
  }
});

document.getElementById('regenerateNiches').addEventListener('click', async () => {
  try {
    showLoading('Regenerating niches...');

    const response = await fetch('/api/generateNiches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: currentToken })
    });

    const data = await response.json();

    if (data.niches) {
      displayNiches(data.niches);
    }

    hideLoading();
  } catch (error) {
    console.error('Failed to regenerate niches:', error);
    hideLoading();
  }
});

function displayNiches(niches) {
  const nichesList = document.getElementById('nichesList');
  nichesList.innerHTML = niches.map((niche, index) => `
    <div class="niche-item bg-dark-card border border-gray-800 rounded-xl p-4 hover:border-accent" data-niche="${niche.title}">
      <h4 class="text-white font-semibold mb-1">${niche.title}</h4>
      <p class="text-gray-400 text-sm">${niche.description || 'Profitable niche opportunity'}</p>
    </div>
  `).join('');

  document.querySelectorAll('.niche-item').forEach(item => {
    item.addEventListener('click', () => selectNiche(item.dataset.niche));
  });
}

async function selectNiche(niche) {
  currentNiche = niche;

  try {
    showLoading('Generating table of contents...');

    const response = await fetch('/api/generateTOC', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche, token: currentToken })
    });

    const data = await response.json();

    if (data.tableOfContents) {
      currentTOC = data.tableOfContents;
      currentProductTitle = data.productTitle;

      document.getElementById('nicheSelection').classList.add('hidden');
      document.getElementById('productGeneration').classList.remove('hidden');
      document.getElementById('productTitle').textContent = currentProductTitle;
      document.getElementById('productNiche').textContent = `Niche: ${currentNiche}`;

      displayTableOfContents(data.tableOfContents);
      await generateAllChapters();
    }

    hideLoading();
  } catch (error) {
    console.error('Failed to generate TOC:', error);
    hideLoading();
    alert('Failed to generate table of contents. Please try again.');
  }
}

function displayTableOfContents(toc) {
  const tocContainer = document.getElementById('tableOfContents');
  tocContainer.innerHTML = toc.map((chapter, index) => `
    <div class="chapter-item bg-dark-card border border-gray-800 rounded-xl overflow-hidden">
      <div class="chapter-expand p-4 flex justify-between items-center" data-chapter="${index}">
        <div class="flex items-center gap-3">
          <span class="text-accent font-semibold">${chapter.chapter}</span>
          <h4 class="text-white font-medium">${chapter.title}</h4>
        </div>
        <div class="flex items-center gap-3">
          <span class="status-badge status-generating" id="status-${index}">Pending</span>
          <svg class="w-5 h-5 text-gray-400 transform transition-transform" id="arrow-${index}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>
      </div>
      <div class="chapter-content px-4 pb-4" id="content-${index}">
        <div class="text-gray-300 text-sm whitespace-pre-wrap"></div>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.chapter-expand').forEach(expand => {
    expand.addEventListener('click', () => {
      const index = expand.dataset.chapter;
      const content = document.getElementById(`content-${index}`);
      const arrow = document.getElementById(`arrow-${index}`);

      content.classList.toggle('expanded');
      arrow.classList.toggle('rotate-180');
    });
  });
}

async function generateAllChapters() {
  for (let i = 0; i < currentTOC.length; i++) {
    const chapter = currentTOC[i];
    const statusEl = document.getElementById(`status-${i}`);
    const contentEl = document.getElementById(`content-${i}`).querySelector('div');

    statusEl.textContent = 'Generating...';
    statusEl.className = 'status-badge status-generating';

    try {
      const response = await fetch('/api/generateChapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: currentNiche,
          chapterTitle: chapter.title,
          chapterNumber: chapter.chapter,
          token: currentToken
        })
      });

      const data = await response.json();

      if (data.content) {
        contentEl.textContent = data.content;
        statusEl.textContent = 'Complete';
        statusEl.className = 'status-badge status-complete';
      }
    } catch (error) {
      console.error(`Failed to generate chapter ${i + 1}:`, error);
      statusEl.textContent = 'Failed';
      statusEl.className = 'status-badge';
      statusEl.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
      statusEl.style.color = '#f44336';
    }
  }

  document.getElementById('generationComplete').classList.remove('hidden');
}

document.getElementById('goToGhostwriter').addEventListener('click', () => {
  showView('ghostwriterView');
  loadGhostwriterMode();
});

document.getElementById('goToMentor').addEventListener('click', () => {
  showView('mentorView');
});

document.getElementById('goToSynthesiseFromGhostwriter').addEventListener('click', () => {
  showView('synthesiseView');
});

async function loadGhostwriterMode() {
  const noProduct = document.getElementById('ghostwriterNoProduct');
  const content = document.getElementById('ghostwriterContent');

  noProduct.classList.add('hidden');
  content.classList.remove('hidden');
}

document.querySelectorAll('.asset-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const assetType = btn.dataset.asset;
    await generateAsset(assetType);
  });
});

async function generateAsset(assetType) {
  try {
    showLoading('Generating marketing asset...');

    const response = await fetch('/api/generateGhostwriter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: currentToken, assetType })
    });

    const data = await response.json();

    if (response.ok && data.content) {
      document.getElementById('assetOutput').classList.remove('hidden');
      document.getElementById('assetTitle').textContent = getAssetTitle(assetType);
      document.getElementById('assetContent').textContent = data.content;

      document.getElementById('assetOutput').scrollIntoView({ behavior: 'smooth' });
    } else {
      alert(data.error || 'Failed to generate asset');
    }

    hideLoading();
  } catch (error) {
    console.error('Failed to generate asset:', error);
    hideLoading();
    alert('Failed to generate asset. Please try again.');
  }
}

function getAssetTitle(assetType) {
  const titles = {
    salesPage: 'Long-Form Sales Page',
    emailSequence: '7-Email Launch Sequence',
    videoScripts: 'Video Scripts',
    socialContent: 'Social Media Content'
  };
  return titles[assetType] || 'Marketing Asset';
}

document.getElementById('sendMentorMessage').addEventListener('click', sendMentorMessage);
document.getElementById('mentorInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMentorMessage();
});

async function sendMentorMessage() {
  const input = document.getElementById('mentorInput');
  const message = input.value.trim();

  if (!message) return;

  const messagesContainer = document.getElementById('chatMessages');

  const userMessageDiv = document.createElement('div');
  userMessageDiv.className = 'chat-message flex justify-end';
  userMessageDiv.innerHTML = `<div class="user-message">${message}</div>`;
  messagesContainer.appendChild(userMessageDiv);

  input.value = '';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const response = await fetch('/api/generateMentorResponse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: currentToken, message })
    });

    const data = await response.json();

    if (data.response) {
      const mentorMessageDiv = document.createElement('div');
      mentorMessageDiv.className = 'chat-message flex justify-start';
      mentorMessageDiv.innerHTML = `<div class="mentor-message">${data.response}</div>`;
      messagesContainer.appendChild(mentorMessageDiv);

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  } catch (error) {
    console.error('Failed to get mentor response:', error);
    alert('Failed to get response. Please try again.');
  }
}

document.getElementById('generate90DayPlan').addEventListener('click', async () => {
  try {
    showLoading('Generating 90-day plan...');

    const response = await fetch('/api/generateMentorPlan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: currentToken })
    });

    const data = await response.json();

    if (response.ok && data.plan) {
      const messagesContainer = document.getElementById('chatMessages');

      const planMessageDiv = document.createElement('div');
      planMessageDiv.className = 'chat-message flex justify-start';
      planMessageDiv.innerHTML = `<div class="mentor-message"><strong>Your 90-Day Business Plan:</strong><br><br>${data.plan}</div>`;
      messagesContainer.appendChild(planMessageDiv);

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
      alert(data.error || 'Failed to generate plan');
    }

    hideLoading();
  } catch (error) {
    console.error('Failed to generate plan:', error);
    hideLoading();
    alert('Failed to generate plan. Please try again.');
  }
});

if (currentToken) {
  document.getElementById('tokenModal').classList.add('hidden');
  document.getElementById('mainContent').classList.remove('hidden');
  showView('dashboardView');
}
