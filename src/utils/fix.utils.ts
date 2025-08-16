/**
 * Fixes the background of the input range elements that have a data
 * attribute 'data-range-style' set to 'overflowing-thumb'. This function
 * listens for the 'input' event and updates the '--_webkit-progression-width'
 * CSS custom property to reflect the percentage value of the input range.
 */
export function fixInputRangeBackground() {
  const inputsWithThumbArray = document.querySelectorAll<HTMLInputElement>(
    `input[type="range"][data-range-style="overflowing-thumb"]`
  );

  for (const input of inputsWithThumbArray) {
    input.addEventListener("input", (e) => {
      const input = e.currentTarget as HTMLInputElement;
      const { min, max, valueAsNumber } = input;

      const percentage: number = Math.floor(
        (valueAsNumber / Number(max)) * 100
      );

      const stringResult: string = `${percentage}%`;

      input.style.setProperty("--_webkit-progression-width", stringResult);
    });
  }
}
