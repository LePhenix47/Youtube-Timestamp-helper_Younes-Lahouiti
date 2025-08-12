import "./sass/main.scss";

function fixInputRangeBackground() {
  const inputsWithThumbArray = document.querySelectorAll<HTMLInputElement>(
    `input[type="range"][data-range-style="overflowing-thumb"]`
  );

  for (const input of inputsWithThumbArray) {
    input.addEventListener("input", (e) => {
      const input = e.currentTarget as HTMLInputElement;
      const { min, max, valueAsNumber } = input;

      const percentage: number = Math.round(
        (valueAsNumber / Number(max)) * 100
      );

      const stringResult: string = `${percentage}%`;

      input.style.setProperty("--_webkit-progression-width", stringResult);
    });
  }
}

fixInputRangeBackground();

console.log("Hello world!");
