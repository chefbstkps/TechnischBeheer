-- Bewaar handmatige volgorde van politierangen
ALTER TABLE ranks
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

WITH ordered_ranks AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY rang, created_at, id) AS next_order
  FROM ranks
)
UPDATE ranks
SET sort_order = ordered_ranks.next_order
FROM ordered_ranks
WHERE ranks.id = ordered_ranks.id
  AND ranks.sort_order IS NULL;

CREATE OR REPLACE FUNCTION set_rank_sort_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sort_order IS NULL THEN
    SELECT COALESCE(MAX(sort_order), 0) + 1
    INTO NEW.sort_order
    FROM ranks;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ranks_set_sort_order ON ranks;

CREATE TRIGGER ranks_set_sort_order
BEFORE INSERT ON ranks
FOR EACH ROW
EXECUTE FUNCTION set_rank_sort_order();

ALTER TABLE ranks
  ALTER COLUMN sort_order SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ranks_sort_order
  ON ranks (sort_order);

CREATE OR REPLACE FUNCTION move_rank(p_rank_id UUID, p_direction TEXT)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current_order INTEGER;
  v_target_id UUID;
  v_target_order INTEGER;
  v_temp_order INTEGER;
BEGIN
  SELECT sort_order
  INTO v_current_order
  FROM ranks
  WHERE id = p_rank_id;

  IF v_current_order IS NULL THEN
    RETURN;
  END IF;

  IF p_direction = 'up' THEN
    SELECT id, sort_order
    INTO v_target_id, v_target_order
    FROM ranks
    WHERE sort_order < v_current_order
    ORDER BY sort_order DESC
    LIMIT 1;
  ELSIF p_direction = 'down' THEN
    SELECT id, sort_order
    INTO v_target_id, v_target_order
    FROM ranks
    WHERE sort_order > v_current_order
    ORDER BY sort_order ASC
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Ongeldige richting: %', p_direction;
  END IF;

  IF v_target_id IS NULL OR v_target_order IS NULL THEN
    RETURN;
  END IF;

  v_temp_order := -v_current_order;

  UPDATE ranks
  SET sort_order = v_temp_order
  WHERE id = p_rank_id;

  UPDATE ranks
  SET sort_order = v_current_order
  WHERE id = v_target_id;

  UPDATE ranks
  SET sort_order = v_target_order
  WHERE id = p_rank_id;
END;
$$;
