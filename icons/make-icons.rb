# Draws the app icon (a volt dumbbell on near-black) as PNGs. No image libraries needed.
# Run from fitness/: /usr/bin/ruby icons/make-icons.rb
require 'zlib'

BG = [10, 11, 13]; FG = [200, 245, 96]

# Signed distance to a rounded rectangle centred at (cx, cy).
def rrect(px, py, cx, cy, hw, hh, r)
  qx = (px - cx).abs - hw + r; qy = (py - cy).abs - hh + r
  Math.hypot([qx, 0].max, [qy, 0].max) + [[qx, qy].max, 0].min - r
end

# Shapes in a 0..1 unit square; `scale` shrinks the art for the maskable safe zone.
def coverage(u, v, scale)
  x = (u - 0.5) / scale + 0.5; y = (v - 0.5) / scale + 0.5
  d = [
    rrect(x, y, 0.5, 0.5, 0.22, 0.035, 0.03),     # bar
    rrect(x, y, 0.29, 0.5, 0.045, 0.2, 0.04),     # inner plates
    rrect(x, y, 0.71, 0.5, 0.045, 0.2, 0.04),
    rrect(x, y, 0.20, 0.5, 0.035, 0.13, 0.03),    # outer plates
    rrect(x, y, 0.80, 0.5, 0.035, 0.13, 0.03),
  ].min
  d * scale
end

def png(path, size, scale)
  rows = ''.b
  aa = 1.0 / size
  size.times do |j|
    rows << "\x00"
    size.times do |i|
      u = (i + 0.5) / size; v = (j + 0.5) / size
      a = (0.5 - coverage(u, v, scale) / aa).clamp(0.0, 1.0)
      3.times { |c| rows << (BG[c] + (FG[c] - BG[c]) * a).round.chr }
    end
  end
  chunk = ->(t, d) { [d.bytesize].pack('N') + t + d + [Zlib.crc32(t + d)].pack('N') }
  File.binwrite(path, "\x89PNG\r\n\x1a\n".b + chunk.('IHDR', [size, size, 8, 2, 0, 0, 0].pack('NNCCCCC')) +
    chunk.('IDAT', Zlib::Deflate.deflate(rows, 9)) + chunk.('IEND', ''))
end

png('icons/icon-192.png', 192, 1.0)
png('icons/icon-512.png', 512, 1.0)
png('icons/apple-touch-icon.png', 180, 1.0)
png('icons/icon-maskable-512.png', 512, 0.78)
puts 'icons written'
