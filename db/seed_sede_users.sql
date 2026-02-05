-- Seed usuarios por sede (rol: user)
-- Clave temporal: 12345678
-- Hash generado con bcryptjs (cost 12)

INSERT INTO app_users (username, password_hash, role, is_active)
VALUES
  ('sede_calle5ta', '$2a$12$Y53Qa2R4.mJ/fwrEdS0vt.uBXgW.F6mAEve1gCyEJKDC1NjsCmP/q', 'user', true),
  ('sede_la39', '$2a$12$Y53Qa2R4.mJ/fwrEdS0vt.uBXgW.F6mAEve1gCyEJKDC1NjsCmP/q', 'user', true),
  ('sede_plazanorte', '$2a$12$Y53Qa2R4.mJ/fwrEdS0vt.uBXgW.F6mAEve1gCyEJKDC1NjsCmP/q', 'user', true),
  ('sede_ciudadjardin', '$2a$12$Y53Qa2R4.mJ/fwrEdS0vt.uBXgW.F6mAEve1gCyEJKDC1NjsCmP/q', 'user', true),
  ('sede_centrosur', '$2a$12$Y53Qa2R4.mJ/fwrEdS0vt.uBXgW.F6mAEve1gCyEJKDC1NjsCmP/q', 'user', true),
  ('sede_palmira', '$2a$12$Y53Qa2R4.mJ/fwrEdS0vt.uBXgW.F6mAEve1gCyEJKDC1NjsCmP/q', 'user', true),
  ('sede_floresta', '$2a$12$Y53Qa2R4.mJ/fwrEdS0vt.uBXgW.F6mAEve1gCyEJKDC1NjsCmP/q', 'user', true),
  ('sede_floralia', '$2a$12$Y53Qa2R4.mJ/fwrEdS0vt.uBXgW.F6mAEve1gCyEJKDC1NjsCmP/q', 'user', true),
  ('sede_guaduales', '$2a$12$Y53Qa2R4.mJ/fwrEdS0vt.uBXgW.F6mAEve1gCyEJKDC1NjsCmP/q', 'user', true),
  ('sede_bogota', '$2a$12$Y53Qa2R4.mJ/fwrEdS0vt.uBXgW.F6mAEve1gCyEJKDC1NjsCmP/q', 'user', true),
  ('sede_chia', '$2a$12$Y53Qa2R4.mJ/fwrEdS0vt.uBXgW.F6mAEve1gCyEJKDC1NjsCmP/q', 'user', true)
ON CONFLICT (username) DO NOTHING;
