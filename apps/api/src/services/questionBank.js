import fs from "fs";
import path from "path";

const dataPath = path.join(process.cwd(), "src", "data", "questions.json");
const DEFAULT_GROUP_ID = "default";
const NEW_GROUP_ID = "new";

function createGroup(id, title, questions = []) {
  return {
    id,
    title,
    questions
  };
}

function normalizeQuestion(question) {
  return {
    id: String(question.id ?? "").trim(),
    title: String(question.title ?? "").trim(),
    description: String(question.description ?? "").trim(),
    streetView: {
      lat: question.streetView.lat,
      lng: question.streetView.lng,
      heading: question.streetView.heading,
      pitch: question.streetView.pitch,
      fov: question.streetView.fov,
      panoId: question.streetView.panoId ?? null
    }
  };
}

function normalizeBank(rawData) {
  if (Array.isArray(rawData)) {
    return {
      groups: [
        createGroup(
          DEFAULT_GROUP_ID,
          "默认题库",
          rawData.map((question) => normalizeQuestion(question))
        ),
        createGroup(NEW_GROUP_ID, "新题库", [])
      ]
    };
  }

  if (!rawData || typeof rawData !== "object" || !Array.isArray(rawData.groups)) {
    return {
      groups: [createGroup(DEFAULT_GROUP_ID, "默认题库", []), createGroup(NEW_GROUP_ID, "新题库", [])]
    };
  }

  const groups = rawData.groups.map((group) =>
    createGroup(
      String(group.id ?? "").trim(),
      String(group.title ?? "").trim(),
      Array.isArray(group.questions) ? group.questions.map((question) => normalizeQuestion(question)) : []
    )
  );

  if (!groups.find((group) => group.id === NEW_GROUP_ID)) {
    groups.push(createGroup(NEW_GROUP_ID, "新题库", []));
  }

  return { groups };
}

function readBank() {
  const raw = fs.readFileSync(dataPath, "utf8");
  return normalizeBank(JSON.parse(raw));
}

function writeBank(bank) {
  fs.writeFileSync(dataPath, `${JSON.stringify(bank, null, 2)}\n`, "utf8");
}

function findGroup(bank, groupId) {
  return bank.groups.find((group) => group.id === groupId) ?? null;
}

function findQuestionEntry(bank, questionId) {
  for (const group of bank.groups) {
    const question = group.questions.find((item) => item.id === questionId);
    if (question) {
      return { group, question };
    }
  }
  return null;
}

export function getQuestionBank() {
  return readBank();
}

export function listGroups() {
  return readBank().groups.map((group) => ({
    id: group.id,
    title: group.title,
    count: group.questions.length
  }));
}

export function getGroupById(groupId) {
  return findGroup(readBank(), groupId);
}

export function addGroup(input) {
  const bank = readBank();
  if (findGroup(bank, input.id)) {
    return { error: "Group id already exists" };
  }

  const group = createGroup(input.id, input.title, []);
  bank.groups.push(group);
  writeBank(bank);
  return { group };
}

export function updateGroup(groupId, input) {
  const bank = readBank();
  const group = findGroup(bank, groupId);
  if (!group) {
    return { error: "Group not found" };
  }

  if (input.id && input.id !== groupId && findGroup(bank, input.id)) {
    return { error: "Group id already exists" };
  }

  const nextId = input.id ? input.id : group.id;
  group.id = nextId;
  group.title = input.title ?? group.title;
  writeBank(bank);
  return { group };
}

export function deleteGroup(groupId) {
  const bank = readBank();
  const groupIndex = bank.groups.findIndex((group) => group.id === groupId);
  if (groupIndex === -1) {
    return { error: "Group not found" };
  }

  bank.groups.splice(groupIndex, 1);
  if (!bank.groups.find((group) => group.id === NEW_GROUP_ID)) {
    bank.groups.push(createGroup(NEW_GROUP_ID, "新题库", []));
  }
  writeBank(bank);
  return { ok: true };
}

export function listQuestions(groupId) {
  const bank = readBank();
  if (!groupId) {
    return bank.groups.flatMap((group) =>
      group.questions.map((question) => ({
        ...question,
        groupId: group.id,
        groupTitle: group.title
      }))
    );
  }

  const group = findGroup(bank, groupId);
  if (!group) {
    return null;
  }

  return group.questions.map((question) => ({
    ...question,
    groupId: group.id,
    groupTitle: group.title
  }));
}

export function getQuestionById(id) {
  const bank = readBank();
  const entry = findQuestionEntry(bank, id);
  if (!entry) {
    return null;
  }

  return {
    ...entry.question,
    groupId: entry.group.id,
    groupTitle: entry.group.title
  };
}

export function addQuestion(input) {
  const bank = readBank();
  if (findQuestionEntry(bank, input.id)) {
    return { error: "Question id already exists" };
  }

  const targetGroupId = input.groupId || NEW_GROUP_ID;
  const group = findGroup(bank, targetGroupId);
  if (!group) {
    return { error: "Group not found" };
  }

  const question = normalizeQuestion(input);
  group.questions.push(question);
  writeBank(bank);
  return {
    question: {
      ...question,
      groupId: group.id,
      groupTitle: group.title
    }
  };
}

export function updateQuestion(questionId, input) {
  const bank = readBank();
  const entry = findQuestionEntry(bank, questionId);
  if (!entry) {
    return { error: "Question not found" };
  }

  if (input.id && input.id !== questionId && findQuestionEntry(bank, input.id)) {
    return { error: "Question id already exists" };
  }

  const nextGroupId = input.groupId ?? entry.group.id;
  const nextGroup = findGroup(bank, nextGroupId);
  if (!nextGroup) {
    return { error: "Group not found" };
  }

  const updatedQuestion = normalizeQuestion({
    ...entry.question,
    ...input,
    streetView: {
      ...entry.question.streetView,
      ...input.streetView
    }
  });

  entry.group.questions = entry.group.questions.filter((question) => question.id !== questionId);
  nextGroup.questions.push(updatedQuestion);
  writeBank(bank);

  return {
    question: {
      ...updatedQuestion,
      groupId: nextGroup.id,
      groupTitle: nextGroup.title
    }
  };
}

export function deleteQuestion(questionId) {
  const bank = readBank();
  const entry = findQuestionEntry(bank, questionId);
  if (!entry) {
    return { error: "Question not found" };
  }

  entry.group.questions = entry.group.questions.filter((question) => question.id !== questionId);
  writeBank(bank);
  return { ok: true };
}
