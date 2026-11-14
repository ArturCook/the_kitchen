// Export the reader's sections and wording, without the data files' storage fields.
function kitchenMarkdown() {
  const blocks = [];
  const add = text => blocks.push(text);
  const text = lines => lines.join('\n');
  // Explicit breaks keep the spacing visible in rendered Markdown too.
  const majorGap = () => add('<br>\n<br>');
  const operatorGap = () => add('<br>');
  const help = window.KITCHEN_HELP;
  add(`# ${help.title}`);
  add(help.subtitle);
  for (const [heading, lines] of Object.entries(help)) {
    if (heading === 'title' || heading === 'subtitle') continue;
    if (heading !== 'introduction') {
      if (heading === 'Usage') majorGap();
      add(`## ${heading}`);
    }
    add(text(lines));
  }

  function operatorText(operator) {
    add(`## ${operator.file.split('/').pop()}`);
    if (operator.original_id) {
      add(`\`futaba.md\` operator > \`${operator.original_id}.md\` operator.`);
      add(`Nickname: ${operator.title}`);
      add('---');
    }
    for (const [heading, field] of [
      ['Trigger', 'trigger'], ['Purpose', 'purpose'], ['Key Idea', 'key_idea'],
      ['Procedure', 'procedure'], ['Outputs', 'outputs'], ['Do Not Use', 'do_not_use'],
    ]) {
      add(`### ${heading}`);
      add(field === 'procedure' ? operator[field].map(text).join('\n\n') : text(operator[field]));
      if (['key_idea', 'procedure', 'outputs'].includes(field)) add('---');
    }
  }

  majorGap();
  add('# Operators');
  for (const operator of window.KITCHEN_OPERATORS) {
    operatorGap();
    operatorText(operator);
    const behavior = window.KITCHEN_BEHAVIORS.find(entry => entry.id === operator.id);
    add('---');
    for (const section of behavior.sections) {
      if (section.heading === 'Who') {
        add('### Behavior');
        add(`Who: ${section.lines[0]}`);
        const description = text(section.lines.slice(1)).trim();
        if (description) add(description);
      } else {
        add(`### ${section.heading}`);
        add(text(section.lines));
      }
      if (section.heading !== 'Voice') add('---');
    }
  }

  majorGap();
  add('# Inverse operators');
  let inverseCount = 0;
  for (const original of window.KITCHEN_OPERATORS) {
    const operator = window.KITCHEN_INVERSE_OPERATORS.find(entry => entry.original_id === original.id);
    if (!operator) continue;
    if (inverseCount++) operatorGap();
    operatorText(operator);
    const key = window.KITCHEN_KEYS.find(entry => entry.id === operator.id);
    add('---');
    add('### Fear');
    // Style the prompt labels separately from their answers.
    add(key.lines.map(line => line.replace(/^\[([^\]]+)\]/, '*$1...*')).join('\n\n'));
  }
  return blocks.join('\n\n').trim() + '\n';
}

function exportKitchen() {
  const blob = new Blob([kitchenMarkdown()], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'the_kitchen.md';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
