const errorBanner = document.getElementById("error-banner");

export function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

export function clearError() {
  errorBanner.hidden = true;
  errorBanner.textContent = "";
}
