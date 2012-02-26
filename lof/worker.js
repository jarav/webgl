(function() {
  var ANGLE_INC, CHARGE_MAG, CHARGE_RAD, CHARGE_RAD_SQ, DR, MAX_LINES, POT_INF, POT_ITRNS_PER_RUN, SZ, SZ_SQ, cos, fieldAt, fieldCal, fieldOfCharge, floor, g_charge_count, g_charges, g_cur_charge, g_cur_charge_indx, g_cur_lof_indx, g_func, g_funcs, g_lofs, g_pos_indx_start, g_pots, insideACharge, msgHandler, out, potCal, sin, sqrt;
  CHARGE_MAG = 10000.0;
  POT_INF = 10000.0;
  POT_ITRNS_PER_RUN = 1000;
  SZ = 640;
  SZ_SQ = SZ * SZ;
  CHARGE_RAD = 5.0;
  CHARGE_RAD_SQ = CHARGE_RAD * CHARGE_RAD;
  DR = 2.0;
  MAX_LINES = 10;
  ANGLE_INC = 2 * Math.PI / MAX_LINES;
  floor = Math.floor;
  sqrt = Math.sqrt;
  cos = Math.cos;
  sin = Math.sin;
  g_pos_indx_start = 0;
  g_pots = null;
  g_func = null;
  g_cur_charge = null;
  g_cur_charge_indx = null;
  g_cur_lof_indx = null;
  g_charges = null;
  g_charge_count = null;
  g_lofs = null;
  potCal = function() {
    var d, dx, dy, pos_indx, x, y;
    pos_indx = g_pos_indx_start;
    while (pos_indx < SZ_SQ) {
      x = pos_indx % SZ - SZ / 2;
      y = floor(pos_indx / SZ) - SZ / 2;
      dx = g_cur_charge.pos.x - x;
      dy = g_cur_charge.pos.y - y;
      d = sqrt(dx * dx + dy * dy);
      g_pots[pos_indx] += g_cur_charge.sign * (d <= 1 ? POT_INF : CHARGE_MAG / d);
      if (pos_indx > g_pos_indx_start + POT_ITRNS_PER_RUN) {
        self.postMessage({
          status: 'paused'
        });
        g_pos_indx_start = pos_indx + 1;
        return;
      } else {
        ++pos_indx;
      }
    }
    self.postMessage({
      status: 'done',
      output: g_pots
    });
  };
  fieldCal = function() {
    var angle, charge, cur_x, cur_y, factor, field, itern, lof;
    lof = [];
    charge = g_charges[g_cur_charge_indx];
    factor = charge.sign * DR;
    angle = ANGLE_INC * g_cur_lof_indx;
    cur_x = charge.pos.x + CHARGE_RAD * cos(angle);
    cur_y = charge.pos.y + CHARGE_RAD * sin(angle);
    itern = 0;
    while (true) {
      lof.push(cur_x, cur_y, 0);
      field = fieldAt(cur_x, cur_y);
      cur_x += factor * field.x;
      cur_y += factor * field.y;
      ++itern;
      if (insideACharge(cur_x, cur_y) || out(cur_x, cur_y) || itern > 8000) {
        break;
      }
    }
    g_lofs.push(lof);
    if (g_cur_lof_indx < (MAX_LINES - 1)) {
      ++g_cur_lof_indx;
    } else {
      if (g_cur_charge_indx < (g_charge_count - 1)) {
        g_cur_lof_indx = 0;
        ++g_cur_charge_indx;
      } else {
        self.postMessage({
          status: 'done',
          output: g_lofs
        });
        return;
      }
    }
    self.postMessage({
      status: 'paused'
    });
  };
  fieldAt = function(x_pos, y_pos) {
    var charge, f, net_field_x, net_field_y, norm, _i, _len;
    net_field_x = 0;
    net_field_y = 0;
    for (_i = 0, _len = g_charges.length; _i < _len; _i++) {
      charge = g_charges[_i];
      f = fieldOfCharge(charge, x_pos, y_pos);
      net_field_x += f.x;
      net_field_y += f.y;
    }
    norm = sqrt(net_field_x * net_field_x + net_field_y * net_field_y);
    return {
      x: net_field_x / norm,
      y: net_field_y / norm
    };
  };
  fieldOfCharge = function(charge, x_pos, y_pos) {
    var d, dx, dy, factor;
    dx = x_pos - charge.pos.x;
    dy = y_pos - charge.pos.y;
    d = sqrt(dx * dx + dy * dy);
    factor = charge.sign * CHARGE_MAG / (d * d * d);
    return {
      x: dx * factor,
      y: dy * factor
    };
  };
  insideACharge = function(x, y) {
    var charge, dx, dy, _i, _len;
    for (_i = 0, _len = g_charges.length; _i < _len; _i++) {
      charge = g_charges[_i];
      dx = x - charge.pos.x;
      dy = y - charge.pos.y;
      if (dx * dx + dy * dy < CHARGE_RAD_SQ) {
        return true;
      }
    }
    return false;
  };
  out = function(x, y) {
    if (x > 256 || x < -255 || y > 256 || y < -255) {
      return true;
    }
    return false;
  };
  g_funcs = {
    'pot_calc': potCal,
    'field_calc': fieldCal
  };
  msgHandler = function(e) {
    var cmd, data, func_id;
    cmd = e.data.cmd;
    data = e.data.data;
    switch (cmd) {
      case 'register':
        func_id = data;
        g_func = g_funcs[func_id];
        break;
      case 'start':
        switch (g_func) {
          case potCal:
            if (data.pot != null) {
              g_pots = data.pot;
            }
            g_cur_charge = data.charge;
            g_pos_indx_start = 0;
            break;
          case fieldCal:
            g_charges = data;
            g_charge_count = g_charges.length;
            g_lofs = [];
            g_cur_charge_indx = 0;
            g_cur_lof_indx = 0;
        }
        g_func();
        break;
      case 'continue':
        g_func();
    }
  };
  self.addEventListener('message', msgHandler);
}).call(this);
