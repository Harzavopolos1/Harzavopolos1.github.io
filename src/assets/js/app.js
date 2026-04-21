// Ore's Blog — Client-side JavaScript
// Features: sidebar search redirect, subscribe (magic-link via app.arnavnavon.com),
// progressive profile form, copy-link helper, client-side search.

// ============================================================================
// 1. SIDEBAR SEARCH REDIRECT
// ============================================================================
function sidebarSearch(event) {
  event.preventDefault();
  const query = document.getElementById('sidebarSearchInput').value.trim();
  if (query) {
    window.location.href = `/search/?q=${encodeURIComponent(query)}`;
  }
  return false;
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
  .then(function (r) { return r.json(); })
  .then(function (d) {
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
  .catch(function () {
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
    interests: Array.from(form.querySelectorAll('[name=interests]:checked')).map(function (c) { return c.value; })
  };

  fetch('https://app.arnavnavon.com/auth/profile', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  })
  .then(function () {
    form.style.display = 'none';
    if (msg) {
      msg.textContent = 'Thanks! Check your inbox to finish signing in.';
      msg.style.color = '#155724';
    }
  })
  .catch(function () {});

  return false;
}

// If already signed in, hide the subscribe form.
(function checkSignedIn() {
  fetch('https://app.arnavnavon.com/auth/me', { credentials: 'include' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
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
    .catch(function () {});
})();

// ============================================================================
// 3. COPY-LINK HELPER FOR SHARE BUTTONS
// ============================================================================
function copyLink(event) {
  event.preventDefault();
  const url = window.location.href;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(showCopyFeedback).catch(function () { fallbackCopyLink(url); });
  } else {
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
    alert('Link: ' + url);
  }
  document.body.removeChild(textArea);
}

function showCopyFeedback() {
  const copyBtn = document.querySelector('[data-action="copy-link"]');
  if (copyBtn) {
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(function () { copyBtn.textContent = originalText; }, 2000);
  }
}

// ============================================================================
// 4. CLIENT-SIDE SEARCH (reads window.SEARCH_DATA)
// ============================================================================
document.addEventListener('DOMContentLoaded', function () {
  initializeSearch();
});

function initializeSearch() {
  const searchInput = document.getElementById('searchPageInput');
  if (!searchInput) return;

  const params = new URLSearchParams(window.location.search);
  const queryParam = params.get('q');
  if (queryParam) {
    searchInput.value = decodeURIComponent(queryParam);
    performSearch(queryParam);
  }

  let searchTimeout;
  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function () { performSearch(searchInput.value); }, 300);
  });
}

function performSearch(query) {
  const resultsDiv = document.getElementById('searchResults');
  resultsDiv.innerHTML = '';
  if (!query || query.trim().length === 0) return;

  if (typeof window.SEARCH_DATA === 'undefined') {
    resultsDiv.innerHTML = '<p>Search index not loaded. Please refresh the page.</p>';
    return;
  }

  const searchQuery = query.toLowerCase().trim();
  const results = window.SEARCH_DATA.filter(function (post) {
    const titleMatch = post.title.toLowerCase().includes(searchQuery);
    const contentMatch = post.content.toLowerCase().includes(searchQuery);
    const categoryMatch = post.categories.some(function (cat) { return cat.toLowerCase().includes(searchQuery); });
    return titleMatch || contentMatch || categoryMatch;
  });

  if (results.length === 0) {
    resultsDiv.innerHTML = '<p class="no-results">No posts found for "' + escapeHtml(query) + '"</p>';
    return;
  }

  const resultsList = document.createElement('div');
  resultsList.className = 'search-results-list';
  results.forEach(function (post) {
    resultsList.appendChild(createResultItem(post, searchQuery));
  });
  resultsDiv.appendChild(resultsList);
}

function createResultItem(post, searchQuery) {
  const item = document.createElement('div');
  item.className = 'search-result-item';
  const highlightedTitle = highlightMatches(post.title, searchQuery);
  const highlightedContent = highlightMatches(post.content, searchQuery);
  item.innerHTML =
    '<a href="' + post.url + '" class="result-title">' + highlightedTitle + '</a>' +
    '<div class="result-meta">' +
    '<span class="result-date">' + post.date + '</span>' +
    (post.categories.length > 0 ? '<span class="result-categories">' + post.categories.join(', ') + '</span>' : '') +
    '</div>' +
    '<p class="result-excerpt">' + highlightedContent + '</p>';
  return item;
}

function highlightMatches(text, query) {
  if (!query || query.trim().length === 0) return escapeHtml(text);
  const escapedQuery = escapeHtml(query);
  const regex = new RegExp('(' + escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return escapeHtml(text).replace(regex, '<mark>$1</mark>');
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, function (m) { return map[m]; });
}
