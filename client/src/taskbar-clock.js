// Taskbar clock

const taskbarClock = document.getElementById("taskbar-clock");

function updateClock() {
  taskbarClock.textContent = new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

updateClock();
setInterval(updateClock, 1000 * 30);
