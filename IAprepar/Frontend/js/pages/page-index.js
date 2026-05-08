'use strict';

const PageIndex = {
  init() {
    if (Session.isLoggedIn()) {
      const banner = document.getElementById('logged-in-banner');
      if (banner) banner.style.display = 'flex';
    }
  }
};
