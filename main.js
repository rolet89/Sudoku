
function createGrid() {
  const container = document.getElementById('sudoku-container');
  container.innerHTML = '';
  for (let i = 0; i < 81; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 1;
    container.appendChild(input);
  }
}
function newGame() {
  createGrid();
}
function solve() {
  alert('Lösung kommt später :)');
}
window.onload = createGrid;
