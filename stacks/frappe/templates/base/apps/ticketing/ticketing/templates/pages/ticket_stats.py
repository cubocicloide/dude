"""Server-side context for the /ticket_stats portal page.

A file pair under templates/pages/ — <route>.py + <route>.html — becomes a
website route automatically. get_context runs on every request; whatever it
puts on `context` is available to the Jinja template.
"""

from ticketing.api import ticket_stats


def get_context(context):
	context.no_cache = 1
	context.stats = ticket_stats()
	return context
