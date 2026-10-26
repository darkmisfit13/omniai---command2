-- Private request/response channel for the owner's laptop Ollama agent.
-- Each signed-in user can only publish or receive broadcasts on their own topic.
create policy "local_ai_user_receive_own_broadcast"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'local-ai:' || (select auth.uid())::text
);

create policy "local_ai_user_send_own_broadcast"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'local-ai:' || (select auth.uid())::text
);

create policy "local_ai_user_read_own_presence"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'presence'
  and (select realtime.topic()) = 'local-ai:' || (select auth.uid())::text
);

create policy "local_ai_user_write_own_presence"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'presence'
  and (select realtime.topic()) = 'local-ai:' || (select auth.uid())::text
);
