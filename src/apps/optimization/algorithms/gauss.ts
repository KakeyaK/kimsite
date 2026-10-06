import { isZero } from "@apps/optimization/lib/format";
import {
  NotImplementedError,
  type GaussFrame,
  type Matrix,
} from "@apps/optimization/lib/types";

/**
 * Gaussian elimination on an augmented matrix (last column = right-hand side).
 *
 * Yield one frame after every row operation, with the whole matrix as it is at that point:
 *
 *   yield { matrix, op: { kind: "add", target: 1, source: 0, factor: -3 }, pivot: { row: 0, col: 0 } };
 *
 * The starting matrix is shown by the UI already, so don't yield it. Frames are copied the moment
 * they are yielded: it is fine to keep changing the same `matrix` afterwards. Don't change `system`.
 *
 * How far to go (echelon form, back substitution, full Gauss-Jordan) is up to you.
 * `isZero` in lib/format.ts helps with floating-point pivots.
 */
// eslint-disable-next-line require-yield, @typescript-eslint/no-unused-vars
export function* gauss(system: Matrix): Generator<GaussFrame> {
  /**
   * 1. select pivot (variable that appear in more than 1 row).
   * 2. for each other row, apply the operation original_row - k / c * pivot_row, where k is the coefficient of the variable in original_row and c in the pivot's coefficient.
   * 3. reorganize rows to keep the rows ordered by most amount of variables present?
   * 4. repeat
   */
  const matrix = system.map((row) => [...row]);
  const nRows = system.length;
  const nColumns = system[0].length - 1;

  let completedRows = 0;

  for (let column = 0; column < nColumns; column++) {
    for (let row = completedRows; row < nRows; row++) {
      if (!isZero(matrix[row][column])) {
        const pivot = { row: completedRows, col: column };

        if (row != completedRows) {
          [matrix[completedRows], matrix[row]] = [
            matrix[row],
            matrix[completedRows],
          ];
          yield {
            matrix,
            op: { kind: "swap", a: completedRows, b: row },
            pivot,
          };
        }

        for (
          let modifiedRow = completedRows + 1;
          modifiedRow < nRows;
          modifiedRow++
        ) {
          const factor =
            (-1 * matrix[modifiedRow][column]) / matrix[completedRows][column];
          for (
            let modifiedColumn = 0;
            modifiedColumn < nColumns + 1;
            modifiedColumn++
          ) {
            matrix[modifiedRow][modifiedColumn] +=
              factor * matrix[completedRows][modifiedColumn];
          }

          yield {
            matrix,
            op: {
              kind: "add",
              target: modifiedRow,
              source: completedRows,
              factor: factor,
            },
          };
        }

        completedRows++;
        break;
      }
    }
  }
}
