// Updated task cycling function for checkbox syntax
export function cycleTaskStateInTextLine(line: string): string {
  // Handle checkbox format: [ ] -> [ ] (Doing) -> [x] -> [ ]
  if (line.match(/^-\s+\[ \]\s+(?!\(Doing\))/)) {
    // TODO -> DOING: Add (Doing) modifier
    return line.replace(/^(-\s+\[ \])(\s+)/, '$1 (Doing)$2');
  }
  if (line.match(/^-\s+\[ \]\s+\(Doing\)/)) {
    // DOING -> DONE: Change to [x] and remove modifier
    return line.replace(/^(-\s+)\[ \]\s+\(Doing\)(\s+)/, '$1[x]$2');
  }
  if (line.match(/^-\s+\[x\]/)) {
    // DONE -> TODO: Change to [ ]
    return line.replace(/^(-\s+)\[x\](\s+)/, '$1[ ]$2');
  }
  // Plain bullet -> TODO: Add [ ]
  if (line.match(/^-\s+/)) {
    return line.replace(/^(-\s+)/, '$1[ ] ');
  }
  // No bullet -> Add bullet with TODO
  return `- [ ] ${line}`;
}