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
  return false;
}

// ============================================================================
// 2. SUBSCRIBE HANDLER (localStorage)
// ============================================================================
function handleSubscribe(event) {
  event.preventDefault();
  const form = event.target;
  const emailInput = form.querySelector('input[type="email"]');
  const email = emailInput.value.trim();

  if (email) {
    // Store email to localStorage
    localStorage.setItem('subscriberEmail', email);

    // Show confirmation message
    const msgDiv = document.getElementById('signupMsg');
    msgDiv.textContent = 'Thanks! Check your email to confirm.';
    msgDiv.style.display = 'block';

    // Clear input and hide message after 5 seconds
    emailInput.value = '';
    setTimeout(() => {
      msgDiv.style.display = 'none';
    }, 5000);
  }

  return false;
}

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
