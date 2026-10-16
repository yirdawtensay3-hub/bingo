import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function checkCartela(calledNumbers: number[], numbers: number[]): number {
  let hits = 0;

  hits += checkRows(calledNumbers, numbers);
  hits += checkColumns(calledNumbers, numbers);
  hits += checkDiagonals(calledNumbers, numbers);
  hits += checkFDiagonals(calledNumbers, numbers);
  hits += checkCorner(calledNumbers, numbers);
  return hits;
}

function checkColumns(numbers: number[], cartelaNum: number[]) {
  const size = 5; // 5x5 board
  let hit = 0;
  const called = new Set(numbers);

  for (let row = 0; row < size; row++) {
    let matched = 0;
    let needed = size;

    for (let col = 0; col < size; col++) {
      if (row === 2 && col === 2) {
        needed--;
        continue;
      }

      const index = row * size + col;

      if (called.has(cartelaNum[index])) {
        matched++;
      }
    }

    if (matched === needed) {
      hit++;
    }
  }

  return hit;
}

function checkRows(numbers: number[], cartelaNum: number[]) {
  const size = 5; // 5x5 board
  const called = new Set(numbers);
  let hit = 0;

  for (let col = 0; col < size; col++) {
    let matched = 0;
    let needed = size;

    for (let row = 0; row < size; row++) {
      if (row === 2 && col === 2) {
        needed--; // this column only needs 4 matches
        continue;
      }

      const index = row * size + col;

      if (called.has(cartelaNum[index])) {
        matched++;
      }
    }

    if (matched === needed) {
      hit++;
    }
  }

  return hit;
}

function checkDiagonals(numbers: number[], cartelaNum: number[]) {
  const called = new Set(numbers);
  let hit = 0;

  for (let idx = 0; idx < 25; idx += 6) {
    if (idx == 12) continue;
    if (called.has(cartelaNum[idx])) {
      hit++
    }
  }
  if (hit == 4) return 1;
  return 0;
}

function checkFDiagonals(numbers: number[], cartelaNum: number[]) {
  const called = new Set(numbers);
  let hit = 0;

  for (let idx = 4; idx < 21; idx += 4) {
    if (idx == 12) continue;
    if (called.has(cartelaNum[idx])) {
      hit++
    }
  }
  if (hit == 4) return 1;
  return 0;
}

function checkCorner(numbers: number[], cartelaNum: number[]) {
  if (numbers.includes(cartelaNum[0]) &&
    numbers.includes(cartelaNum[4]) &&
    numbers.includes(cartelaNum[20]) &&
    numbers.includes(cartelaNum[24])
  ) {
    return 1;
  }
  return 0;
}

