CREATE TABLE IF NOT EXISTS boat_dna_specs_backup_029_hull_material AS
SELECT
  boat_id,
  specs,
  NOW() AS backed_up_at
FROM boat_dna
WHERE LOWER(BTRIM(COALESCE(specs->>'hull_material', ''))) IN (
  'cat',
  'catamaran',
  'flybridge',
  'mono hull',
  'monohull',
  'motor yacht',
  'motoryacht',
  'multi hull',
  'multihull',
  'power boat',
  'powerboat',
  'sail boat',
  'sailboat',
  'trimaran'
);

WITH polluted AS (
  SELECT
    boat_id,
    specs,
    LOWER(BTRIM(COALESCE(specs->>'hull_material', ''))) AS hull_token,
    NULLIF(BTRIM(COALESCE(specs->>'vessel_type', '')), '') AS existing_vessel_type
  FROM boat_dna
  WHERE LOWER(BTRIM(COALESCE(specs->>'hull_material', ''))) IN (
    'cat',
    'catamaran',
    'flybridge',
    'mono hull',
    'monohull',
    'motor yacht',
    'motoryacht',
    'multi hull',
    'multihull',
    'power boat',
    'powerboat',
    'sail boat',
    'sailboat',
    'trimaran'
  )
),
cleaned AS (
  SELECT
    boat_id,
    specs - 'hull_material' AS specs_without_hull_material,
    existing_vessel_type,
    CASE
      WHEN hull_token IN ('cat', 'catamaran', 'multi hull', 'multihull') THEN 'catamaran'
      WHEN hull_token IN ('mono hull', 'monohull', 'sail boat', 'sailboat') THEN 'monohull'
      WHEN hull_token = 'trimaran' THEN 'trimaran'
      WHEN hull_token IN ('flybridge', 'motor yacht', 'motoryacht', 'power boat', 'powerboat') THEN 'powerboat'
      ELSE NULL
    END AS promoted_vessel_type
  FROM polluted
)
UPDATE boat_dna d
SET specs = CASE
  WHEN cleaned.existing_vessel_type IS NULL
       AND cleaned.promoted_vessel_type IS NOT NULL
    THEN jsonb_set(
      cleaned.specs_without_hull_material,
      '{vessel_type}',
      to_jsonb(cleaned.promoted_vessel_type),
      true
    )
  ELSE cleaned.specs_without_hull_material
END
FROM cleaned
WHERE d.boat_id = cleaned.boat_id;
