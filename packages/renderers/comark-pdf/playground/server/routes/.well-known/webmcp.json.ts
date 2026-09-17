export default defineEventHandler((event) => {
  setResponseStatus(event, 404)
  return null
})
