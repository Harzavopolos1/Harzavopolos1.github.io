// Ore's Blog — Client-side JavaScript
// Features: search, sidebar search redirect, subscribe to localStorage, copy-link helper

// ============================================================================
// 1. SIDEBAR SEARCH REDIRECT
// ============================================================================
function sidebarSearch(event) {
  event.preventDefault();
  const query = document.getElementById('sidebarSearchInput').value.trim();
  if (query) {
    window.location.href = `/search/?q=${encodeURIComponent(query)}`;
  }


// ============================================================================
// 2. SUBSCRIBE: Enter → send magic link → reveal optional profile fields
// ============================================================================
function handleSubscribe(event) {
  event.preventDefault();
  var form = event.target;
  var input = form.querySelector('input[name=email]');
  var email = (input.value || '').trim();
  var msg = document.getElementById('signupMsg');
  if (!email) return false;

  msg.textContent = 'Sending you a sign-in link…';
  msg.style.color = '';
  msg.style.display = 'block';

  fetch('https://app.arnavnavon.com/auth/magic-link', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ email: email, source: location.pathname })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d && d.ok) {
      msg.textContent = 'Check your inbox — click the link to confirm.';
      msg.style.color = '#155724';
      input.disabled = true;
      window.__arnavSignupEmail = email;
      var profile = document.getElementById('subscribeProfile');
      if (profile) profile.style.display = 'block';
    } else {
      msg.textContent = (d && d.error) || 'Something went wrong — try again.';
      msg.style.color = '#842029';
    }
  })
  .catch(function(){
    msg.textContent = 'Network error — try again.';
    msg.style.color = '#842029';
  });

  return false;
}

function handleSubscribeProfile(event) {
  event.preventDefault();
  var form = event.target;
  var email = window.__arnavSignupEmail;
  var msg = document.getElementById('signupMsg');
  if (!email) return false;
  var payload = {
    email: email,
    name: (form.querySelector('[name=name]') || {}).value || null,
    age_range: (form.querySelector('[name=age_range]') || {}).value || null,
    interests: Array.from(form.querySelectorAll('[name=interests]:checked')).map(function(c){return c.value;})
  };
  fetch('https://app.arnavnavon.com/auth/profile', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  }).then(function(){
    form.style.display = 'none';
    msg.textContent = 'Thanks! Check your inbox to finish signing in.';
    msg.style.color = '#155724';
  }).catch(function(){});
  return false;
}

// If already signed in, hide the subscribe form.
(function checkSignedIn() {
  fetch('https://app.arnavnavon.com/auth/me', { credentials: 'include' })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (!d || !d.ok) return;
      var form = document.getElementById('subscribeForm');
      if (form) form.style.display = 'none';
      var msg = document.getElementById('signupMsg');
      if (msg) {
        msg.textContent = 'Signed in as ' + d.email;
        msg.style.color = '#155724';
        msg.style.display = 'block';
      }
    })
    .catch(function(){});
})();

  return false;
}

// ============================================================================
// 2. SUBSCRIBE HANDLER (localStorage)
// ============================================================================

// ============================================================================
// 3. COPY-LINK HELPER FOR SHARE BUTTONS
// ============================================================================
function copyLink(event) {
  event.preventDefault();
  const url = window.location.href;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    // Modern browsers with Clipboard API
    navigator.clipboard.writeText(url).then(() => {
      showCopyFeedback();
    }).catch(() => {
      fallbackCopyLink(url);
    });
  } else {
    // Fallback for older browsers
    fallbackCopyLink(url);
  }
}

function fallbackCopyLink(url) {
  const textArea = document.createElement('textarea');
  textArea.value = url;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    showCopyFeedback();
  } catch (err) {
    // If all else fails, just alert the URL
    alert('Link: ' + url);
  }
  document.body.removeChild(textArea);
}

function showCopyFeedback() {
  // Find the copy-link button and show feedback
  const copyBtn = document.querySelector('[data-action="copy-link"]');
  if (copyBtn) {
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  }
}

// ============================================================================
// 4. CLIENT-SIDE SEARCH (reads window.SEARCH_DATA)
// ============================================================================

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  initializeSearch();
});

function initializeSearch() {
  const searchInput = document.getElementById('searchPageInput');

  // Only initialize search if we're on the search page (searchPageInput exists)
  if (!searchInput) {
    return;
  }

  // Get ?q= parameter from URL and populate search input
  const params = new URLSearchParams(window.location.search);
  const queryParam = params.get('q');
  if (queryParam) {
    searchInput.value = decodeURIComponent(queryParam);
    performSearch(queryParam);
  }

  // Debounced search on input
  let searchTimeout;
  searchInput.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(this.value);
    }, 300);
  });
}

function performSearch(query) {
  const resultsDiv = document.getElementById('searchResults');

  // Clear results
  resultsDiv.innerHTML = '';

  // If query is empty, show nothing
  if (!query || query.trim().length === 0) {
    return;
  }

  // Make sure search data is available
  if (typeof window.SEARCH_DATA === 'undefined') {
    resultsDiv.innerHTML = '<p>Search index not loaded. Please refresh the page.</p>';
    return;
  }

  // Normalize query for searching
  const searchQuery = query.toLowerCase().trim();

  // Filter posts by title, categories, or content
  const results = window.SEARCH_DATA.filter(post => {
    const titleMatch = post.title.toLowerCase().includes(searchQuery);
    const contentMatch = post.content.toLowerCase().includes(searchQuery);
    const categoryMatch = post.categories.some(cat => cat.toLowerCase().includes(searchQuery));

    return titleMatch || contentMatch || categoryMatch;
  });

  // Display results
  if (results.length === 0) {
    resultsDiv.innerHTML = `<p class="no-results">No posts found for "${escapeHtml(query)}"</p>`;
    return;
  }

  const resultsList = document.createElement('div');
  resultsList.className = 'search-results-list';

  results.forEach(post => {
    const resultItem = createResultItem(post, searchQuery);
    resultsList.appendChild(resultItem);
  });

  resultsDiv.appendChild(resultsList);
}

function createResultItem(post, searchQuery) {
  const item = document.createElement('div');
  item.className = 'search-result-item';

  // Highlight query in title
  const highlightedTitle = highlightMatches(post.title, searchQuery);

  // Highlight query in content preview
  const highlightedContent = highlightMatches(post.content, searchQuery);

  item.innerHTML = `
    <a href="${post.url}" class="result-title">${highlightedTitle}</a>
    <div class="result-meta">
      <span class="result-date">${post.date}</span>
      ${post.categories.length > 0 ? `<span class="result-categories">${post.categories.join(', ')}</span>` : ''}
    </div>
    <p class="result-excerpt">${highlightedContent}</p>
  `;

  return item;
}

function highlightMatches(text, query) {
  if (!query || query.trim().length === 0) {
    return escapeHtml(text);
  }

  const escapedQuery = escapeHtml(query);
  const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

  return escapeHtml(text).replace(regex, '<mark>$1</mark>');
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}


// ============================================================================
});
