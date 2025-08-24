/**
 * Formats a given date using provided formatting options.
 *
 * @param {Date | string | number} date - The date to format.
 * @param {Object} options - The formatting options for Intl.DateTimeFormat.
 * @param {string} [locale="en-US"] - The locale for formatting the date.
 * @returns {string} The formatted date string, or an error message if formatting fails.
 */
export function formatDateWithOptions(
  date: Date | string | number,
  options: object,
  locale: string
): string {
  try {
    const dateIsInvalid =
      // The date is invalid if the date is not an instance of the Date prototype or
      // that its type is not a string nor a number
      !(date instanceof Date) &&
      typeof date !== "string" &&
      typeof date !== "number";
    if (dateIsInvalid) {
      throw new TypeError(
        `Invalid date argument found, expected it to be an instance of the Date prototype or at least either a string or a number but instead got 
          \nValue: ${date}, of type: ${typeof date}`
      );
    }

    const optionsAreInvalid = !options;
    if (optionsAreInvalid) {
      throw new TypeError(
        `Invalid options argument found, expected it to be an object but instead got \nValue: ${options}, of type: ${typeof options}`
      );
    }

    const localeIsInvalid =
      typeof locale !== "undefined" && typeof locale !== "string";
    if (localeIsInvalid) {
      throw new TypeError(
        `Invalid locale argument found, expected it to be a string but instead got \nValue: ${locale}, of type: ${typeof locale}`
      );
    }

    const dateInstance = date instanceof Date ? date : new Date(date);

    const formatter = new Intl.DateTimeFormat(locale, options);

    return formatter.format(dateInstance);
  } catch (error) {
    console.error("Error formatting date:", error.message);
    return `Invalid date`;
  }
}

/**
 * Formats a number based on the provided locale and options.
 *
 * @param {number} number - The number to be formatted.
 * @param {Intl.LocalesArgument} locale - The locale to be used for formatting the number. It should be a string with the country code or undefined.
 * @param {Intl.NumberFormatOptions} options - An object containing the formatting options for the number. It should have the properties `minimumFractionDigits` and `maximumFractionDigits`, both of which should be numbers.
 * @returns {string} The formatted number as a string.
 * @throws {TypeError} If the `number` argument is not a number or is NaN.
 *
 * @example
 * const number = 1234.5678;
 * const locale = 'en-US';
 * const options = {
 *   minimumFractionDigits: 2,
 *   maximumFractionDigits: 4
 * };
 *
 * const formattedNumber = formatNumberWithOptions(number, locale, options);
 * console.log(formattedNumber); // Output: "1,234.5678"
 */
export function formatNumberWithOptions(
  number: number,
  locale: Intl.LocalesArgument,
  options: Intl.NumberFormatOptions
): string {
  // Validate the types of input arguments
  const hasInvalidTypes = typeof number !== "number" || Number.isNaN(number);
  if (hasInvalidTypes) {
    console.error(
      `Invalid argument for number: Type: ${typeof number} of value ${number}`
    );
    return "";
  }

  const hasInvalidLocale = typeof locale !== "string" && locale !== undefined;
  if (hasInvalidLocale) {
    console.error(
      `Invalid argument for the locale: must be either a string with the country code or undefined`
    );
    return "";
  }

  const formatter = new Intl.NumberFormat(locale, options);

  return formatter.format(number);
}

/**
 * Formats a video duration in seconds into a string representation of the duration in hours, minutes, and seconds.
 *
 * @param {number} durationInSeconds - The duration of the video in seconds.
 * @returns {string} The formatted duration string in the format "HH:MM:SS". If the duration is less than one hour, the format will be "MM:SS" (if minutes is a single digit value it won't be padded with a leading zero).
 */
export function formatVideoTimeStamp(
  durationInSeconds: number,
  forceHoursPadding: boolean = false
): string {
  const seconds: number = Math.floor(durationInSeconds) % 60;
  const minutes: number = Math.floor(durationInSeconds / 60) % 60;
  const hours: number = Math.floor(durationInSeconds / 3_600);

  const options: Intl.NumberFormatOptions = {
    minimumIntegerDigits: 2,
  };

  const formattedMinutes: string = formatNumberWithOptions(
    minutes,
    "en-US",
    options
  );

  const formattedSeconds: string = formatNumberWithOptions(
    seconds,
    "en-US",
    options
  );

  if (hours === 0 && !forceHoursPadding) {
    return `${minutes}:${formattedSeconds}`;
  }

  return `${hours}:${formattedMinutes}:${formattedSeconds}`;
}
