const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderAttention, findAll, text, visible, accessibleName } = require("./helpers/attention-strip-render.cjs");

const groups = [
  { key: "now", label: "Now", mobileLabel: "Now" },
  { key: "coming_up", label: "Coming up", mobileLabel: "Coming up" },
  { key: "needs_next_step", label: "Needs a next step", mobileLabel: "Next step" },
];

function itemsFor(group, count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${group}-${index + 1}`,
    href: `/tasks?focus=${group}-${index + 1}&view=detail`,
    title: `${group} item ${index + 1}`,
    subtitle: `Project ${index + 1}`,
    kind: "Task",
    status: "In progress",
    priority: "High",
    group,
    date: null,
    role: null,
    action: `Review ${group} item ${index + 1}`,
  }));
}

function links(node, viewport) {
  return findAll(node, (element) => element.tag === "a" && visible(element, viewport));
}

function buttons(node, viewport) {
  return findAll(node, (element) => element.tag === "button" && visible(element, viewport));
}

function viewportText(node, viewport) {
  if (typeof node === "string") return node;
  if (!visible(node, viewport)) return "";
  return node.children.map((child) => viewportText(child, viewport)).join(" ").replace(/\s+/g, " ").trim();
}

function one(elements, message) {
  assert.equal(elements.length, 1, message);
  return elements[0];
}

function namedButton(document, name, viewport = "mobile") {
  return one(
    buttons(document, viewport).filter((button) => accessibleName(button) === name),
    `Expected exactly one ${viewport} button named "${name}"`
  );
}

function controlledElement(document, button) {
  const id = button.attrs["aria-controls"];
  assert.ok(id, `${accessibleName(button)} needs aria-controls`);
  return one(findAll(document, (element) => element.attrs.id === id), `aria-controls="${id}" must resolve uniquely`);
}

function lane(document, label) {
  return one(
    findAll(document, (element) => element.attrs["aria-label"] === `${label} items` && visible(element, "desktop")),
    `Expected exactly one desktop lane named "${label} items"`
  );
}

function mobileTabs(document) {
  const tabGroup = one(
    findAll(document, (element) => element.attrs.role === "group" && element.attrs["aria-label"] === "Attention groups" && visible(element, "mobile")),
    "Mobile group controls must remain available"
  );
  assert.ok(!visible(tabGroup, "desktop"), "Mobile group controls must stay below md");
  const tabs = buttons(tabGroup, "mobile");
  assert.equal(tabs.length, 3);
  return tabs;
}

function mobileTab(document, group) {
  return mobileTabs(document)[groups.findIndex(({ key }) => key === group)];
}

function assertSelectedGroup(document, group, expectedItems) {
  const tabs = mobileTabs(document);
  assert.deepEqual(tabs.map((tab) => tab.attrs["aria-pressed"]), groups.map(({ key }) => String(key === group)));
  const selectedTab = mobileTab(document, group);
  assert.ok(visible(controlledElement(document, selectedTab), "mobile"), "Selected tab must control its visible group");
  assert.deepEqual(links(document, "mobile").map((link) => link.attrs.href), expectedItems.map((item) => item.href));
}

test("desktop: all seven Coming up items are available without Show more", () => {
  const items = itemsFor("coming_up", 7);
  const { document } = renderAttention(items);
  assert.deepEqual(
    links(document, "desktop").map((link) => link.attrs.href),
    items.map((item) => item.href),
    "Every desktop card must be rendered and breakpoint-visible, including cards after the initial mobile three"
  );
  assert.deepEqual(
    buttons(document, "desktop").filter((button) => /^Show (?:\d+ more|more|less)/i.test(accessibleName(button))),
    [],
    "Desktop access must not depend on expanding a truncated group"
  );
});

test("desktop: mixed groups have ordered, populated lanes with their own cards and preserved hrefs", () => {
  const now = itemsFor("now", 5);
  const comingUp = itemsFor("coming_up", 7);
  const nextStep = itemsFor("needs_next_step", 4);
  // Input order must not determine group order or mix cards between lanes.
  const { document } = renderAttention([...nextStep, ...comingUp, ...now]);
  const lanes = groups.map(({ label }) => lane(document, label));
  const renderedLanes = findAll(document, (element) => lanes.includes(element));
  assert.deepEqual(renderedLanes.map((element) => element.attrs["aria-label"]), groups.map(({ label }) => `${label} items`));
  for (const [index, expected] of [now, comingUp, nextStep].entries()) {
    assert.deepEqual(links(lanes[index], "desktop").map((link) => link.attrs.href), expected.map((item) => item.href));
  }
  assert.equal(links(document, "desktop").length, now.length + comingUp.length + nextStep.length);
});

test("desktop: each populated lane has named previous/next buttons controlling its own items", () => {
  const { document } = renderAttention(groups.flatMap(({ key }) => itemsFor(key, 7)));
  const controlledIds = [];
  for (const { key, label } of groups) {
    const groupLane = lane(document, label);
    const previous = namedButton(document, `Previous ${label} items`, "desktop");
    const next = namedButton(document, `Next ${label} items`, "desktop");
    assert.equal(previous.attrs.type, "button");
    assert.equal(next.attrs.type, "button");
    assert.equal(previous.attrs["aria-controls"], next.attrs["aria-controls"]);
    const controlled = controlledElement(document, next);
    assert.ok(findAll(groupLane, (element) => element === controlled).length, "Arrows must target their own lane or an element within it");
    assert.deepEqual(links(controlled, "desktop").map((link) => link.attrs.href), itemsFor(key, 7).map((item) => item.href));
    assert.ok(!visible(previous, "mobile") && !visible(next, "mobile"), "Desktop arrows must not replace mobile controls");
    controlledIds.push(controlled.attrs.id);
  }
  assert.equal(new Set(controlledIds).size, 3, "Each pair must control a different group");
});

test("desktop: empty groups have no item lane, empty list, or carousel controls", () => {
  const { document } = renderAttention(itemsFor("coming_up", 7));
  lane(document, "Coming up");
  for (const label of ["Now", "Needs a next step"]) {
    assert.ok(viewportText(document, "desktop").includes(label), `Empty ${label} must retain a desktop status label`);
    assert.equal(findAll(document, (element) => element.attrs["aria-label"] === `${label} items` && visible(element, "desktop")).length, 0);
    assert.equal(buttons(document, "desktop").filter((button) => [
      `Previous ${label} items`, `Next ${label} items`,
    ].includes(accessibleName(button))).length, 0);
  }
  const desktopLists = findAll(document, (element) => (element.tag === "ul" || element.attrs.role === "list") && visible(element, "desktop"));
  for (const list of desktopLists) {
    assert.ok(links(list, "desktop").length > 0, "An empty group must not render a desktop list panel");
  }
  // Compact empty status labels can use any markup or wording. Their physical
  // size and the lane/card geometry require a browser check, not an SSR claim.
});

for (const { key, mobileLabel } of groups) {
  test(`mobile: ${mobileLabel} alone is auto-selected and initially shows exactly three of seven items`, () => {
    const items = itemsFor(key, 7);
    const { document } = renderAttention(items);
    assertSelectedGroup(document, key, items.slice(0, 3));
    const more = namedButton(document, `Show more ${mobileLabel} items`);
    assert.equal(more.attrs["aria-expanded"], "false");
    assert.equal(text(more), "Show 4 more");
    assert.deepEqual(links(controlledElement(document, more), "mobile").map((link) => link.attrs.href), items.slice(0, 3).map((item) => item.href));
    assert.ok(!visible(more, "desktop"), "The per-group expansion control is mobile-only");
  });
}

test("mobile: tabs keep labels/counts, target distinct panels, and switch between initial three-item groups", () => {
  const groupedItems = [itemsFor("now", 5), itemsFor("coming_up", 7), itemsFor("needs_next_step", 4)];
  let screen = renderAttention([...groupedItems[2], ...groupedItems[1], ...groupedItems[0]]);
  const tabs = mobileTabs(screen.document);
  assert.deepEqual(tabs.map(text), groups.map(({ mobileLabel }, index) => `${mobileLabel} ${groupedItems[index].length}`));
  assert.equal(new Set(tabs.map((tab) => controlledElement(screen.document, tab).attrs.id)).size, 3);
  assertSelectedGroup(screen.document, "now", groupedItems[0].slice(0, 3));
  for (const [index, { key }] of groups.entries()) {
    screen = screen.click(mobileTab(screen.document, key));
    assertSelectedGroup(screen.document, key, groupedItems[index].slice(0, 3));
  }
});

test("mobile: Show more/less is wired independently per group and persists across tab switches", () => {
  const now = itemsFor("now", 5);
  const comingUp = itemsFor("coming_up", 7);
  const nextStep = itemsFor("needs_next_step", 4);
  let screen = renderAttention([...now, ...comingUp, ...nextStep]);

  screen = screen.click(namedButton(screen.document, "Show more Now items"));
  assertSelectedGroup(screen.document, "now", now);
  let less = namedButton(screen.document, "Show fewer Now items");
  assert.equal(less.attrs["aria-expanded"], "true");
  assert.equal(text(less), "Show less");
  assert.equal(links(controlledElement(screen.document, less), "mobile").length, 5);

  screen = screen.click(mobileTab(screen.document, "coming_up"));
  assertSelectedGroup(screen.document, "coming_up", comingUp.slice(0, 3));
  assert.equal(namedButton(screen.document, "Show more Coming up items").attrs["aria-expanded"], "false");
  screen = screen.click(namedButton(screen.document, "Show more Coming up items"));
  assertSelectedGroup(screen.document, "coming_up", comingUp);

  screen = screen.click(mobileTab(screen.document, "now"));
  assertSelectedGroup(screen.document, "now", now);
  screen = screen.click(namedButton(screen.document, "Show fewer Now items"));
  assertSelectedGroup(screen.document, "now", now.slice(0, 3));
  assert.equal(namedButton(screen.document, "Show more Now items").attrs["aria-expanded"], "false");

  screen = screen.click(mobileTab(screen.document, "coming_up"));
  assertSelectedGroup(screen.document, "coming_up", comingUp);
  screen = screen.click(mobileTab(screen.document, "needs_next_step"));
  assertSelectedGroup(screen.document, "needs_next_step", nextStep.slice(0, 3));
  screen = screen.click(namedButton(screen.document, "Show more Next step items"));
  assertSelectedGroup(screen.document, "needs_next_step", nextStep);
  screen = screen.click(namedButton(screen.document, "Show fewer Next step items"));
  assertSelectedGroup(screen.document, "needs_next_step", nextStep.slice(0, 3));
});

test("mobile: empty tabs retain their existing messages without expansion controls", () => {
  let screen = renderAttention(itemsFor("coming_up", 2));
  for (const [key, message] of [
    ["now", "Nothing overdue or due today."],
    ["needs_next_step", "No items need a date or plan."],
  ]) {
    screen = screen.click(mobileTab(screen.document, key));
    assertSelectedGroup(screen.document, key, []);
    assert.ok(text(controlledElement(screen.document, mobileTab(screen.document, key))).includes(message));
    assert.equal(buttons(screen.document, "mobile").filter((button) => /^Show (?:more|fewer)/.test(accessibleName(button))).length, 0);
  }
});

test("mobile: groups with three or fewer items have no Show more control", () => {
  for (const count of [1, 3]) {
    const items = itemsFor("coming_up", count);
    const { document } = renderAttention(items);
    assertSelectedGroup(document, "coming_up", items);
    assert.equal(buttons(document, "mobile").length, 3, "Only the three group tabs should be present");
  }
});

test("mobile: cards preserve link destinations, title/subtitle, action, and visible metadata", () => {
  const items = itemsFor("coming_up", 2);
  Object.assign(items[0], {
    href: "/applications?focus=job-1&view=detail",
    title: "Research & engineering <role>",
    subtitle: "Example & Co",
    kind: "Job",
    status: "Applied",
    action: "Send follow-up",
    date: "2099-01-01",
    role: "follow_up",
  });
  const { document } = renderAttention(items);
  const cards = links(document, "mobile");
  assert.equal(cards.length, 2);
  for (const [index, card] of cards.entries()) {
    const item = items[index];
    assert.equal(card.attrs.href, item.href);
    const paragraphs = findAll(card, (element) => element.tag === "p" && visible(element, "mobile"));
    assert.deepEqual(paragraphs.map(text), [item.title, `${item.kind} · ${item.subtitle}`]);
    const visibleText = findAll(card, (element) => visible(element, "mobile") && element.children.every((child) => typeof child === "string")).map(text);
    for (const expected of [item.action, item.priority, item.status, index === 0 ? "Follow-up" : "No date"]) {
      assert.ok(visibleText.includes(expected), `Mobile card must retain "${expected}"`);
    }
  }
});

test("all-empty: You're clear remains the only state, with no lanes, tabs, arrows, or links", () => {
  const { document } = renderAttention([]);
  const section = one(findAll(document, (element) => element.tag === "section" && element.attrs["aria-label"] === "Needs attention"), "Needs attention section must remain labelled");
  assert.equal(one(findAll(section, (element) => element.tag === "h2"), "Empty-state heading").children.join(""), "You're clear");
  assert.ok(text(section).includes("No overdue work, upcoming deadlines, or missing next steps."));
  for (const viewport of ["mobile", "desktop"]) {
    assert.ok(visible(section, viewport));
    assert.equal(buttons(section, viewport).length, 0);
    assert.equal(links(section, viewport).length, 0);
  }
  assert.equal(findAll(section, (element) => element.attrs["aria-label"]?.endsWith(" items")).length, 0);
});
