import {
  addGroup,
  addQuestion,
  deleteGroup,
  deleteQuestion,
  getGroupById,
  getQuestionById,
  listGroups,
  listQuestions,
  updateGroup,
  updateQuestion
} from "../services/questionBank.js";
import { requireAuth } from "../middleware/auth.js";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validateGroupPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "请求体不能为空";
  }

  if (!payload.id || typeof payload.id !== "string") {
    return "题库组 id 必填";
  }

  if (!payload.title || typeof payload.title !== "string") {
    return "题库组名称必填";
  }

  return null;
}

function validateQuestionPayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    return "请求体不能为空";
  }

  if (!partial || payload.id !== undefined) {
    if (!payload.id || typeof payload.id !== "string") {
      return "题目 id 必填";
    }
  }

  if (!partial || payload.title !== undefined) {
    if (!payload.title || typeof payload.title !== "string") {
      return "题目标题必填";
    }
  }

  if (!partial || payload.description !== undefined) {
    if (payload.description !== undefined && typeof payload.description !== "string") {
      return "题目描述必须为字符串";
    }
  }

  const sourceType = payload.sourceType || "street_view";
  if (!partial && sourceType !== "street_view" && sourceType !== "image") {
    return "题目来源类型无效";
  }

  if (sourceType === "image") {
    const lat = payload.lat;
    const lng = payload.lng;
    if (!partial || lat !== undefined) {
      if (!isFiniteNumber(lat)) {
        return "纬度必须是数字";
      }
    }
    if (!partial || lng !== undefined) {
      if (!isFiniteNumber(lng)) {
        return "经度必须是数字";
      }
    }
    if (!partial || payload.imageUrl !== undefined) {
      if (!payload.imageUrl || typeof payload.imageUrl !== "string") {
        return "图片地址必填";
      }
    }
    if (!partial || payload.description !== undefined) {
      if (!payload.description || typeof payload.description !== "string" || !payload.description.trim()) {
        return "图片题描述必填";
      }
    }
    return null;
  }

  if (!partial || payload.streetView !== undefined) {
    if (!payload.streetView || typeof payload.streetView !== "object") {
      return "streetView 必填";
    }

    const requiredNumericFields = ["lat", "lng", "heading", "pitch", "fov"];
    for (const field of requiredNumericFields) {
      if (!isFiniteNumber(payload.streetView[field])) {
        return `streetView.${field} 必须是数字`;
      }
    }

    if (
      payload.streetView.panoId !== null &&
      payload.streetView.panoId !== undefined &&
      typeof payload.streetView.panoId !== "string"
    ) {
      return "streetView.panoId 必须是字符串或 null";
    }
  }

  return null;
}

export function registerQuestionRoutes(app) {
  app.get("/api/groups", requireAuth, (req, res) => {
    res.json({ items: listGroups(req.user) });
  });

  app.post("/api/groups", requireAuth, (req, res) => {
    const error = validateGroupPayload(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    const result = addGroup({
      id: req.body.id.trim(),
      title: req.body.title.trim()
    }, req.user);

    if (result.error) {
      return res.status(409).json({ error: result.error });
    }

    return res.status(201).json(result.group);
  });

  app.put("/api/groups/:id", requireAuth, (req, res) => {
    const title = req.body?.title;
    const id = req.body?.id;
    if ((title !== undefined && typeof title !== "string") || (id !== undefined && typeof id !== "string")) {
      return res.status(400).json({ error: "题库组字段无效" });
    }

    const result = updateGroup(req.params.id, {
      id: id?.trim(),
      title: title?.trim()
    }, req.user);

    if (result.error === "Group not found") {
      return res.status(404).json({ error: "题库组不存在" });
    }
    if (result.error === "Forbidden") {
      return res.status(403).json({ error: "没有权限修改该题库" });
    }
    if (result.error) {
      return res.status(409).json({ error: result.error });
    }

    return res.json(result.group);
  });

  app.delete("/api/groups/:id", requireAuth, (req, res) => {
    const result = deleteGroup(req.params.id, req.user);
    if (result.error === "Group not found") {
      return res.status(404).json({ error: "题库组不存在" });
    }
    if (result.error === "Forbidden") {
      return res.status(403).json({ error: "没有权限删除该题库" });
    }
    return res.status(204).end();
  });

  app.get("/api/groups/:id/questions", requireAuth, (req, res) => {
    const group = getGroupById(req.params.id, req.user);
    if (!group) {
      return res.status(404).json({ error: "题库组不存在" });
    }

    return res.json({
      group: {
        id: group.id,
        title: group.title,
        ownerUserId: group.ownerUserId,
        ownerUsername: group.ownerUsername,
        canEdit: group.canEdit
      },
      items: listQuestions(req.params.id, req.user)
    });
  });

  app.get("/api/questions", requireAuth, (req, res) => {
    const groupId = typeof req.query.groupId === "string" ? req.query.groupId : "";
    const items = listQuestions(groupId, req.user);
    if (groupId && items === null) {
      return res.status(404).json({ error: "题库组不存在" });
    }
    res.json({ items: items ?? [] });
  });

  app.get("/api/questions/:id", requireAuth, (req, res) => {
    const question = getQuestionById(req.params.id, req.user);
    if (!question) {
      return res.status(404).json({ error: "题目不存在" });
    }

    return res.json(question);
  });

  app.post("/api/questions", requireAuth, (req, res) => {
    const error = validateQuestionPayload(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    const sourceType = req.body.sourceType || "street_view";
    const result = addQuestion({
      id: req.body.id.trim(),
      title: req.body.title.trim(),
      sourceType,
      description: req.body.description?.trim() ?? "",
      groupId: req.body.groupId?.trim() || "new",
      imageUrl: req.body.imageUrl,
      lat: req.body.lat,
      lng: req.body.lng,
      streetView: {
        lat: req.body.streetView?.lat,
        lng: req.body.streetView?.lng,
        heading: req.body.streetView?.heading,
        pitch: req.body.streetView?.pitch,
        fov: req.body.streetView?.fov,
        panoId: req.body.streetView?.panoId ?? null
      }
    }, req.user);

    if (result.error === "Group not found") {
      return res.status(404).json({ error: "题库组不存在" });
    }
    if (result.error === "Forbidden") {
      return res.status(403).json({ error: "没有权限在该题库中创建题目" });
    }
    if (result.error) {
      return res.status(409).json({ error: result.error });
    }

    return res.status(201).json(result.question);
  });

  app.put("/api/questions/:id", requireAuth, (req, res) => {
    const error = validateQuestionPayload(req.body, { partial: true });
    if (error) {
      return res.status(400).json({ error });
    }

    const result = updateQuestion(req.params.id, {
      id: req.body.id?.trim(),
      title: req.body.title?.trim(),
      sourceType: req.body.sourceType,
      description: req.body.description?.trim(),
      groupId: req.body.groupId?.trim(),
      imageUrl: req.body.imageUrl,
      lat: req.body.lat,
      lng: req.body.lng,
      streetView: req.body.streetView
        ? {
            lat: req.body.streetView.lat,
            lng: req.body.streetView.lng,
            heading: req.body.streetView.heading,
            pitch: req.body.streetView.pitch,
            fov: req.body.streetView.fov,
            panoId: req.body.streetView.panoId ?? null
          }
        : undefined
    }, req.user);

    if (result.error === "Question not found") {
      return res.status(404).json({ error: "题目不存在" });
    }
    if (result.error === "Group not found") {
      return res.status(404).json({ error: "题库组不存在" });
    }
    if (result.error === "Forbidden") {
      return res.status(403).json({ error: "没有权限修改该题目" });
    }
    if (result.error) {
      return res.status(409).json({ error: result.error });
    }

    return res.json(result.question);
  });

  app.delete("/api/questions/:id", requireAuth, (req, res) => {
    const result = deleteQuestion(req.params.id, req.user);
    if (result.error === "Question not found") {
      return res.status(404).json({ error: "题目不存在" });
    }
    if (result.error === "Forbidden") {
      return res.status(403).json({ error: "没有权限删除该题目" });
    }
    return res.status(204).end();
  });
}
