-- Item 4 of 0008 did not do anything, and the probe afterwards proved it.
--
-- Postgres does not break a table level grant down into column grants. The
-- role still held SELECT on the whole of `people`, so revoking SELECT on
-- three of its columns changed nothing: the broader privilege kept
-- answering, and `?select=email` with the publishable key still returned 200
-- instead of a permission error.
--
-- The order has to be the other way round. Take the table level privilege
-- away first, then hand back exactly the columns that are not private.
--
-- What stays private: `email` and `phone` are contact details a coordinator
-- collected, and `notes` is what the coordinator wrote about an altar server.
-- The names themselves are not secret; the public fill link shows them to
-- anyone who holds it.

revoke select on public.people from authenticated;
revoke select on public.people from anon;

grant select (
  id,
  parish_id,
  full_name,
  short_name,
  active,
  claimed_by,
  claimed_at,
  created_at,
  updated_at
) on public.people to authenticated;

-- `anon` is granted nothing back. No policy lets an anonymous session read
-- `people` in the first place, and every public screen reaches it through the
-- service role, after the token in the URL has been resolved on the server.

-- INSERT, UPDATE and DELETE are untouched: they are governed by the policies
-- in 0001 and 0008. The app never asks for the three private columns back on
-- a write (every insert and update runs with return=minimal, and the two
-- places that do read rows back ask only for ids), so nothing in the product
-- changes.
