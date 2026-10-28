import { Router, Response } from "express";
import { store } from "../db/store.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";

export const notificationsRouter = Router();

// Get in-app notifications
notificationsRouter.get("/", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const notifs = store.getNotifications(req.user?.role, req.user?.id);
  return res.json(notifs);
});

// Mark single notification as read
notificationsRouter.patch("/:id/read", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  store.markNotificationRead(req.params.id, req.user?.id);
  return res.json({ success: true });
});

// Mark all as read
notificationsRouter.post("/mark-all-read", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  store.markAllNotificationsRead(req.user?.role, req.user?.id);
  return res.json({ success: true });
});
