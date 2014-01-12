// ==UserScript==
// @name             SE-Close-Reason-Editor
// @namespace        CloseReasonEditor
// @version          1.0.0
// @description      Custom off-topic close reasons for non-moderators.
// @include          http://*stackoverflow.com/*
// @include          https://*stackoverflow.com/*
// @include          http://*superuser.com/*
// @include          https://*superuser.com/*
// @include          http://*serverfault.com/*
// @include          https://*serverfault.com/*
// @include          http://*askubuntu.com/*
// @include          https://*askubuntu.com/*
// @include          http://*seasonedadvice.com/*
// @include          https://*seasonedadvice.com/*
// @include          http://*mathoverflow.net/*
// @include          https://*mathoverflow.net/*
// @include          http://*stackapps.com/*
// @include          https://*stackapps.com/*
// @include          http://*stackexchange.com/*
// @include          https://*stackexchange.com/*
// @author           Antony Lau
// ==/UserScript==

function with_jquery(f) {
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.textContent = "(" + f.toString() + ")(jQuery)";
    document.body.appendChild(script);
}

with_jquery(function ($) {

    if (!(window.StackExchange && StackExchange.ready)) return;

    if (!window.localStorage) return;

    if (!(window.Markdown && Markdown.makeHtml)) {
        $.getScript('//cdn.sstatic.net/Js/wmd.en.js?v=849f408083f3').done(function () {
            Markdown.Converter();
        });
    }

    window.CloseReasonEditor = {
        name: 'se-close-reason-editor',
        site: location.host,
        wait: 3000,
        minCharacters: 30,
        maxCharacters: 500,
        coolCharacters: 140,
        warmCharacters: 260,
        hotCharacters: 380,
        pageURL: location.protocol + '//' + location.host + '/?edit-close-reasons',
        privilegesURL: '/help/privileges',
        closePrivilegeURL: '/help/privileges/close-questions',
        init: function () {
            if (location.href === CloseReasonEditor.pageURL) {
                CloseReasonEditor.showPage();
            }
            $(document).ajaxSuccess(function (event, xhr, settings) {
                try {
                    $(xhr.responseText).each(function () {
                        if (this.id && this.id === "popup-close-question") {
                            CloseReasonEditor.modifyDialog($("#popup-close-question"));
                        }
                    });
                } catch (e) {}
            });
        },
        modifyDialog: function (element) {
            var otherListItem = $();
            var otherListItemValue = null;
            CloseReasonEditor.parseCloseDialog(element, function(reason) {
                var listItem = $(this).parents("li").first();
                if (listItem.find("textarea").length) {
                    otherListItem = listItem;
                    otherListItemValue = listItem.find("input[type='radio']").val();
                }
                var item = CloseReasonEditor.getDefault(reason);
                if (item && !item.active) {
                    listItem.remove();
                }
            });
            if (otherListItemValue) {
                var items = CloseReasonEditor.fetch()['custom'];
                for (var i = 0; i < items.length; i++) {
                    var listItem = CloseReasonEditor.getListItem(otherListItemValue, items[i].html, items[i].markdown);
                    if (otherListItem.length) {
                        listItem.insertBefore(otherListItem);
                    } else {
                        element.find("div.close-as-off-topic-pane ul.action-list").append(listItem);
                    }
                }
            }
            element.find("div.close-as-off-topic-pane ul.action-list li").on("click", function() {
                if ($(this).data("markdown")) {
                    $(this).find("div.off-topic-other-comment-container").html('<textarea>' + $(this).data("markdown") + '</textarea>');
                }
                $(this).siblings().each(function() {
                    if ($(this).find("textarea").length && !$(this).find("input[name='original_text']").length) {
                        $(this).find("textarea").remove();
                    }
                });
            });
            var button = $('<a href="javascript:void(0)" style="margin-top: 20px; font-size: 11px;">edit these reasons</a>').on("click", function (event) {
                event.preventDefault();
                location.href = CloseReasonEditor.pageURL;
            });
            if (element.html().indexOf("edit these reasons") === -1) {
                element.find("div.close-as-off-topic-pane").append(button);
            }
        },
        showPage: function () {
            var html = $("html").clone(true, true);
            $("#content").html(CloseReasonEditor.getLoading());
            try {
                CloseReasonEditor.checkReputation(html, function () {
                    CloseReasonEditor.getCloseDialog(html, function (closeDialog) {
                        // Set title
                        document.title = 'Manage Off-Topic Close Reasons - ' + CloseReasonEditor.getSiteName();
                        // Set content template
                        $("#content").html(CloseReasonEditor.getTemplate());
                        // Set default reasons
                        CloseReasonEditor.parseCloseDialog(closeDialog, function (reason) {
                            var item = CloseReasonEditor.getDefault(reason);
                            if (!item) {
                                CloseReasonEditor.setDefault(reason, true);
                                item = CloseReasonEditor.getDefault(reason);
                            }
                            reason = CloseReasonEditor.getActivatableReason(reason, item.active);
                            $("div.default-close-reasons").append(reason);
                        });
                        CloseReasonEditor.updateDefaultActiveCount();
                        // Set custom reasons
                        var items = CloseReasonEditor.fetch()['custom'];
                        for (var i = 0; i < items.length; i++) {
                            $("div.custom-close-reasons").append(CloseReasonEditor.getEditableReason(items[i].html));
                        }
                        // Add custom reason button
                        $("#add-custom-reason").on("click", function () {
                            $("div.custom-close-reasons").append(CloseReasonEditor.getDisposableReasonTextarea('This question appears to be off-topic because it is about'));
                        });
                    });
                }, function (privilegeName, minReputation) {
                    // Set title
                    document.title = 'This page requires more privileges - ' + CloseReasonEditor.getSiteName();
                    // Set content template
                    $("#content").html(CloseReasonEditor.getError(privilegeName, minReputation));
                });
            } catch (e) {}
        },
        checkReputation: function (html, success, fail) {
            var reputation = CloseReasonEditor.getReputation(html.find("a.profile-me span.reputation").text());
            var isModerator = html.find("div.topbar").html().indexOf("♦") !== -1;
            $.get(CloseReasonEditor.privilegesURL).done(function (result) {
                var privilegeTableRow = $(result).find("div.privilege-table-row[data-href='" + CloseReasonEditor.closePrivilegeURL + "']");
                var minReputation = CloseReasonEditor.getReputation(privilegeTableRow.find("div.rep-level").text());
                var privilegeName = privilegeTableRow.find("div.short-description").text();
                if (isModerator || reputation >= minReputation) {
                    success();
                } else {
                    fail(privilegeName, minReputation);
                }
            });
        },
        getSiteName: function () {
            var siteName = document.title;
            if (siteName.match(/ - (.*)$/)) {
                siteName = siteName.match(/ - (.*)$/)[1];
            }
            return siteName;
        },
        getReputation: function (reputationText) {
            return parseInt(reputationText.replace(/[^\d]/g, ''), 10)
        },
        getCloseDialog: function (html, callback) {
            var ids = [];
            html.find("#content a.question-hyperlink").each(function () {
                var href, match, id;
                if (href = $(this).attr("href")) {
                    if (match = href.match(/questions\/(\d+)\//)) {
                        if (id = match[1]) {
                            ids.push(id);
                        }
                    }
                }
            });
            var success = function(element) {
                callback($(element));
            };
            $.get('/flags/questions/' + ids[0] + '/close/popup').done(success).fail(function () {
                setTimeout(function () {
                    $.get('/flags/questions/' + ids[1] + '/close/popup').done(success);
                }, CloseReasonEditor.wait);
            });
        },
        parseCloseDialog: function (closeDialog, callback) {
            closeDialog.find("div.close-as-off-topic-pane ul.action-list span.action-name").each(function () {
                var item = $(this).clone(true, true);
                item.find("a").each(function() {
                    $(this).removeAttr("target");
                });
                var reason = item.html();
                if (!reason.match(/^Other:/)) {
                    callback.call(this, reason);
                }
            });
        },
        parseMarkdown: function (markdown) {
            return Markdown.makeHtml(markdown).replace(/^<p>/, '').replace(/<\/p>$/, '');
        },
        getTemplate: function () {
            return '\
            <div class="subheader">\
                <h1>Manage Off-Topic Close Reasons</h1>\
            </div>\
            <div id="mainbar">\
                <h2 style="display: inline-block;">Default Off-Topic Close Reasons</h2>\
                <span class="default-active-count" style="margin-left: 20px;">1 / 3 active</span>\
                <p style="color: #999">The close reasons chosen by the site moderators.</p>\
                <div class="default-close-reasons" style="margin-bottom: 40px;"></div>\
                <h2 style="display: inline-block;">Custom Off-Topic Close Reasons</h2>\
                <p style="color: #999">With great responsibility comes great power. Now it\'s your turn to edit these close reasons.</p>\
                <div class="custom-close-reasons" style="margin-bottom: 40px;"></div>\
                <div class="form-submit">\
                    <input id="add-custom-reason" type="submit" value="Add Custom Reason">\
                </div>\
            </div>\
            <div id="sidebar"></div>\
            ';
        },
        getLoading: function () {
            return '\
            <div class="subheader">\
                <h1>Manage Off-Topic Close Reasons</h1>\
            </div>\
            <div id="mainbar">\
                <div class="content-page">\
                    <p>Loading...</p>\
                </div>\
            </div>\
            <div id="sidebar"></div>\
            ';
        },
        getError: function (privilegeName, minReputation) {
            return '\
            <div class="subheader">\
                <h1>This page requires more privileges</h1>\
            </div>\
            <div id="mainbar">\
                <div class="content-page">\
                    <p>The page you\'re trying to visit requires the privilege “<a href="' + CloseReasonEditor.closePrivilegeURL + '">' + privilegeName + '</a>.”</p>\
                    <p>You receive additional privileges on ' + CloseReasonEditor.getSiteName() + ' by earning more <a href="/help/whats-reputation">reputation</a> through participation on the site. When you have earned at least ' + minReputation + ' reputation, you will receive the “' + privilegeName + '” privilege and will be allowed to view this page.</p>\
                    <p>Visit the <a href="/help/privileges">privileges page</a> to learn more about the privileges you can earn.</p>\
                </div>\
            </div>\
            <div id="sidebar"></div>\
            ';
        },
        getItem: function () {
            return $('\
            <div class="item" style="margin-bottom: 10px;">\
                <div class="item-left" style="float:left; width:600px;"></div>\
                <div class="item-right" style="float: left;"></div>\
                <div style="clear:both;"></div>\
            </div>\
            ');
        },
        getListItem: function (value, html, markdown) {
            return $('\
            <li class="action-selected">\
                <label>\
                    <input type="radio" name="close-as-off-topic-reason" value="' + value + '" data-subpane-name="" data-other-comment-id="">\
                    <span class="action-name">' + html + '</span>\
                </label>\
                <div class="off-topic-other-comment-container"></div>\
            </li>\
            ').data("markdown", markdown).on("click", function(event) {
                event.preventDefault();
                $(this).find("input[type='radio']").prop("checked", true);
                $(this).parents("ul").first().find(".action-selected").removeClass("action-selected");
                $(this).addClass("action-selected");
                $("#popup-close-question").find("input[type='submit']").prop("disabled", false).removeClass("disabled-button").css("cursor", "");
            });
        },
        getPosition: function (element) {
            if (element instanceof HTMLElement) {
                element = $(element);
            }
            if (element instanceof jQuery) {
                var parents = element.parents(".item");
                if (parents.length) {
                    var item = parents.first();
                    return item.index();
                }
            }
            return false;
        },
        getButton: function (name) {
            return $('<a href="javascript:void(0)" style="margin-left: 20px;">' + name + '</a>');
        },
        getReason: function (reason) {
            reason = $('<div>' + reason + '</div>').find('span.bounty-indicator-tab').remove().end().html();
            reason = '<blockquote><p>' + reason + '</p></blockquote>';
            return CloseReasonEditor.getItem().find('.item-left').append(reason).end();
        },
        getActivatableReason: function (reason, active) {
            var reasonHTML = CloseReasonEditor.getReason(reason);

            function getActivateButton() {
                return CloseReasonEditor.getButton('activate').on('click', function (event) {
                    event.preventDefault();
                    CloseReasonEditor.setDefault(reason, true);
                    reasonHTML.find(".item-left").removeClass('deactivated').css('opacity', 1);
                    CloseReasonEditor.updateDefaultActiveCount();
                    $(this).replaceWith(getDeactivateButton());
                });
            }

            function getDeactivateButton() {
                return CloseReasonEditor.getButton('deactivate').on('click', function (event) {
                    event.preventDefault();
                    CloseReasonEditor.setDefault(reason, false);
                    reasonHTML.find(".item-left").addClass('deactivated').css('opacity', 0.4);
                    CloseReasonEditor.updateDefaultActiveCount();
                    $(this).replaceWith(getActivateButton());
                });
            }

            var button;
            if (active) {
                reasonHTML.find(".item-left").css('opacity', 1);
                button = getDeactivateButton();
            } else {
                reasonHTML.find(".item-left").addClass('deactivated').css('opacity', 0.4);
                button = getActivateButton();
            }
            return reasonHTML.find(".item-right").append(button).end();
        },
        getEditableReason: function (reason) {
            reason = CloseReasonEditor.getReason(reason);
            var edit = CloseReasonEditor.getButton('edit').on('click', function (event) {
                event.preventDefault();
                var item = CloseReasonEditor.getCustom(CloseReasonEditor.getPosition(this));
                var reasonTextarea = CloseReasonEditor.getReasonTextarea(item.markdown);
                reason.replaceWith(reasonTextarea);
            });
            var remove = CloseReasonEditor.getButton('remove').on('click', function (event) {
                event.preventDefault();
                if (confirm('Are you sure you want to remove this close reason?')) {
                    CloseReasonEditor.removeCustom(CloseReasonEditor.getPosition(this));
                    reason.remove();
                }
            });
            return reason.find('.item-right').append(edit).append(remove).end();
        },
        getReasonTextarea: function (markdown) {
            function getNotice(length) {
                var notice = '';
                var difference = 0;
                if (length === 0) {
                    difference = CloseReasonEditor.minCharacters - length;
                    notice = 'enter at least ' + difference + ' character' + (difference === 1 ? '' : 's');
                } else if (length < CloseReasonEditor.minCharacters) {
                    difference = CloseReasonEditor.minCharacters - length;
                    notice = difference + ' more to go...';
                } else if (length <= CloseReasonEditor.maxCharacters) {
                    difference = CloseReasonEditor.maxCharacters - length;
                    notice = difference + ' character' + (difference === 1 ? '' : 's') + ' left';
                } else {
                    difference = length - CloseReasonEditor.maxCharacters;
                    notice = 'too long by ' + difference + ' character' + (difference === 1 ? '' : 's');
                }
                return notice;
            }

            function getState(length) {
                if (length <= CloseReasonEditor.coolCharacters) {
                    return 'cool';
                } else if (length <= CloseReasonEditor.warmCharacters) {
                    return 'warm';
                } else if (length <= CloseReasonEditor.hotCharacters) {
                    return 'hot';
                } else {
                    return 'supernova';
                }
            }

            function isReasonValid(reason) {
                reason = reason.trim().toLowerCase();
                var defaultReason = 'This question appears to be off-topic because it is about'.toLowerCase();
                var length = reason.length;
                return reason !== defaultReason && length >= CloseReasonEditor.minCharacters && length <= CloseReasonEditor.maxCharacters;
            }
            var reasonTextarea = CloseReasonEditor.getItem();
            var counter = $('<span class="text-counter ' + getState(markdown.length) + '">' + getNotice(markdown.length) + '</span>');
            var textarea = $('<textarea style="width: 99%;">' + markdown + '</textarea>').on('input', function () {
                var length = $(this).val().length;
                counter.attr('class', 'text-counter ' + getState(length)).html(getNotice(length));
            });
            var done = CloseReasonEditor.getButton('done').on('click', function (event) {
                event.preventDefault();
                var reason = textarea.val();
                if (isReasonValid(reason)) {
                    CloseReasonEditor.setCustom(reason, CloseReasonEditor.getPosition(this));
                    reasonTextarea.replaceWith(CloseReasonEditor.getEditableReason(CloseReasonEditor.parseMarkdown(reason)));
                }
            });
            var cancel = CloseReasonEditor.getButton('cancel').on('click', function (event) {
                event.preventDefault();
                var custom = CloseReasonEditor.getCustom(CloseReasonEditor.getPosition(this));
                var reason = CloseReasonEditor.getEditableReason(CloseReasonEditor.parseMarkdown(custom.markdown));
                reasonTextarea.replaceWith(reason);
            });
            reasonTextarea.addClass('close-as-off-topic-pane');
            reasonTextarea.addClass('close-as-off-topic-pane').find('.item-left').addClass('off-topic-other-comment-container').css({
                display: "block",
                marginTop: 0
            }).append(textarea).append(counter);
            reasonTextarea.find('.item-right').append(done).append(cancel);
            return reasonTextarea;
        },
        getDisposableReasonTextarea: function (markdown) {
            var reasonTextarea = CloseReasonEditor.getReasonTextarea(markdown);
            var cancel = CloseReasonEditor.getButton('cancel').on('click', function (event) {
                event.preventDefault();
                reasonTextarea.remove();
            });
            reasonTextarea.find('a:contains("cancel")').replaceWith(cancel);
            return reasonTextarea;
        },
        getStorage: function () {
            return JSON.parse(localStorage.getItem(CloseReasonEditor.name));
        },
        setStorage: function (data) {
            if (typeof data === 'undefined') {
                data = null;
            }
            localStorage.setItem(CloseReasonEditor.name, JSON.stringify(data));
        },
        validateAllData: function (allData) {
            return allData !== null && typeof allData === 'object';
        },
        validateData: function (data) {
            return data !== null && typeof data === 'object' && Object.prototype.toString.call(data['default']) === '[object Array]' && Object.prototype.toString.call(data['custom']) === '[object Array]';
        },
        fetch: function () {
            var data = data = {
                'default': [],
                'custom': []
            };
            var allData = CloseReasonEditor.getStorage();
            if (CloseReasonEditor.validateAllData(allData) && CloseReasonEditor.validateData(allData[CloseReasonEditor.site])) {
                data = allData[CloseReasonEditor.site];
            }
            return data;
        },
        save: function (data) {
            if (CloseReasonEditor.validateData(data)) {
                var allData = CloseReasonEditor.getStorage();
                if (!CloseReasonEditor.validateAllData(allData)) {
                    allData = {};
                }
                allData[CloseReasonEditor.site] = data;
                CloseReasonEditor.setStorage(allData);
            }
        },
        hash: function (s) {
            return s.split("").reduce(function (a, b) {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
        },
        getDefault: function (reason) {
            var hash = CloseReasonEditor.hash(reason);
            var data = CloseReasonEditor.fetch();
            var item = data['default'];
            for (var i = 0; i < item.length; i++) {
                if (item[i].hash === hash) {
                    return item[i];
                }
            }
            return false;
        },
        setDefault: function (reason, active) {
            var hash = CloseReasonEditor.hash(reason);
            var item = {
                hash: hash,
                html: reason,
                active: active
            };
            var data = CloseReasonEditor.fetch();
            var key = false;
            for (var i = 0; i < data['default'].length; i++) {
                if (data['default'][i].hash === hash) {
                    key = i;
                    break;
                }
            }
            if (key === false) {
                data['default'].push(item);
            } else {
                data['default'][i] = item;
            }
            CloseReasonEditor.save(data);
        },
        getDefaultActiveCount: function () {
            var active = 0;
            var total = 0;
            $("div.default-close-reasons").find("div.item").each(function() {
                if (!$(this).find("div.item-left").hasClass("deactivated")) {
                    active++;
                }
                total++;
            });
            return {
                active: active,
                total: total
            };
        },
        updateDefaultActiveCount: function () {
            var count = CloseReasonEditor.getDefaultActiveCount();
            $(".default-active-count").html(count.active + ' / ' + count.total + ' active');
        },
        getCustom: function (position) {
            var data = CloseReasonEditor.fetch();
            var item = data['custom'];
            for (var i = 0; i < item.length; i++) {
                if (item[i].position === position) {
                    return item[i];
                }
            }
            return false;
        },
        setCustom: function (reason, position) {
            var html = CloseReasonEditor.parseMarkdown(reason);
            var hash = CloseReasonEditor.hash(html);
            var item = {
                hash: hash,
                markdown: reason,
                html: html,
                position: position
            };
            var data = CloseReasonEditor.fetch();
            var key = false;
            for (var i = 0; i < data['custom'].length; i++) {
                if (data['custom'][i].position === position) {
                    key = i;
                    break;
                }
            }
            if (key === false) {
                data['custom'].push(item);
            } else {
                data['custom'][i] = item;
            }
            data['custom'].sort(function (a, b) {
                return a.position - b.position;
            });
            CloseReasonEditor.save(data);
        },
        removeCustom: function (position) {
            var data = CloseReasonEditor.fetch();
            var items = data['custom'];
            for (var i = 0; i < items.length; i++) {
                if (items[i].position > position) {
                    items[i].position--;
                }
            }
            for (var i = 0; i < items.length; i++) {
                if (items[i].position === position) {
                    items.splice(i, 1);
                }
            }
            CloseReasonEditor.save(data);
        }
    };

    CloseReasonEditor.init();
});