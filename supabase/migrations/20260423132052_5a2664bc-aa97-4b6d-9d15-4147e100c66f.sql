-- Remove duplicate menu items, keep oldest
DELETE FROM menu_items a USING menu_items b 
WHERE a.name = b.name 
  AND a.ctid > b.ctid;